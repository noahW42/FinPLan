import json
import os
from datetime import date, timedelta

import plaid
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_login import login_user, logout_user, login_required, current_user
from plaid.api import plaid_api
from plaid.exceptions import ApiException
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from plaid.model.item_remove_request import ItemRemoveRequest
from plaid.model.products import Products
from plaid.model.country_code import CountryCode
from dotenv import load_dotenv
from sqlalchemy import select, func, desc
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException
from werkzeug.security import generate_password_hash, check_password_hash

# Load config.env from the same folder as this file, regardless of where you launch from
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.env"))

from crypto import encrypt, decrypt
from extensions import db, login_manager
from User import User
from PlaidItems import PlaidItem
from Transaction import Transaction

IS_PROD = bool(os.environ.get("FRONTEND_URL"))  # set on Render, not locally

db_url = os.environ.get("DATABASE_URL", "sqlite:///app.db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-me")

app.config.update(
    SESSION_COOKIE_SAMESITE="None" if IS_PROD else "Lax",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SECURE=IS_PROD,
)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
CORS(app, supports_credentials=True, origins=[FRONTEND_URL])
db.init_app(app)
login_manager.init_app(app)

with app.app_context():
    db.create_all()

PLAID_ENV = os.getenv('PLAID_ENV', 'sandbox')
HOSTS = {
    'sandbox': plaid.Environment.Sandbox,
    'production': plaid.Environment.Production,
}
client = plaid_api.PlaidApi(plaid.ApiClient(plaid.Configuration(
    host=HOSTS[PLAID_ENV],
    api_key={"clientId": os.environ["PLAID_CLIENT_ID"], "secret": os.environ["PLAID_SECRET"]},
)))


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(error="Not logged in"), 401


### ERROR HANDLERS

@app.errorhandler(ApiException)
def handle_plaid_error(e):
    try:
        body = json.loads(e.body)
    except Exception:
        body = {}
    app.logger.error("Plaid error: %s", body or str(e))
    return jsonify(
        error=body.get("error_message", "Plaid request failed"),
        error_code=body.get("error_code"),
        request_id=body.get("request_id"),
    ), 502


@app.errorhandler(Exception)
def handle_unexpected(e):
    if isinstance(e, HTTPException):
        return e
    app.logger.exception("Unhandled error")
    return jsonify(error="Internal server error"), 500

@app.get("/health")
def health():
    return jsonify(status="ok")


### PLAID ENDPOINTS

@app.post("/create_link_token")
@login_required
def create_link_token():
    res = client.link_token_create(LinkTokenCreateRequest(
        products=[Products("transactions")],
        client_name="Finance Planner",
        country_codes=[CountryCode("US")],
        language="en",
        user=LinkTokenCreateRequestUser(client_user_id=str(current_user.id)),
    ))
    return jsonify(link_token=res["link_token"])


@app.post("/exchange_public_token")
@login_required
def exchange_public_token():
    data = request.get_json() or {}
    public_token = data.get("public_token")
    institution_name = data.get("institution_name")

    if not public_token:
        return jsonify(error="public_token is required"), 400

    res = client.item_public_token_exchange(
        ItemPublicTokenExchangeRequest(public_token=public_token)
    )

    item = PlaidItem(
        user_id=current_user.id,
        plaid_item_id=res["item_id"],
        access_token_enc=encrypt(res["access_token"]),  # your encryption helper
        institution_name=institution_name,
    )
    db.session.add(item)
    db.session.commit()

    # Trigger initial sync for newly connected item
    try:
        _sync_item(item)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        app.logger.warning(f"Initial sync warning: {e}")

    return jsonify(success=True, item_id=item.id), 201


@app.post("/sync_transactions")
@login_required
def sync_transactions():
    items = db.session.scalars(
        select(PlaidItem).where(PlaidItem.user_id == current_user.id)
    )
    for item in items:
        _sync_item(item)
    db.session.commit()
    return jsonify(success=True)


def _sync_item(item: PlaidItem):
    access_token = decrypt(item.access_token_enc)  # your decryption helper
    cursor = item.cursor
    has_more = True

    while has_more:
        kwargs = {"access_token": access_token}
        if cursor:
            kwargs["cursor"] = cursor

        res = client.transactions_sync(TransactionsSyncRequest(**kwargs))

        for tx in res["added"]:
            _upsert_transaction(item, tx)
        for tx in res["modified"]:
            _upsert_transaction(item, tx)
        for tx in res["removed"]:
            _delete_transaction(tx["transaction_id"])

        cursor = res["next_cursor"]
        has_more = res["has_more"]

    item.cursor = cursor


@app.get("/transactions")
@login_required
def get_transactions():
    txs = db.session.scalars(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc())
    )
    return jsonify(transactions=[
        {
            "id": t.id,
            "date": t.date.isoformat(),
            "merchant_name": t.merchant_name,
            "amount_cents": t.amount_cents,
            "category": t.category,
            "pending": t.pending,
        }
        for t in txs
    ])


def _upsert_transaction(item, tx):
    existing = db.session.scalar(
        select(Transaction).where(Transaction.plaid_transaction_id == tx["transaction_id"])
    )
    if existing is None:
        existing = Transaction(
            user_id=item.user_id,
            plaid_item_id=item.id,
            plaid_transaction_id=tx["transaction_id"],
        )
        db.session.add(existing)

    existing.date = tx["date"]
    existing.merchant_name = tx.get("merchant_name") or tx.get("name") or "Unknown Vendor"
    existing.amount_cents = round(tx["amount"] * 100)
    existing.category = (tx.get("personal_finance_category") or {}).get("primary")
    existing.pending = tx.get("pending", False)


def _delete_transaction(plaid_transaction_id):
    tx = db.session.scalar(
        select(Transaction).where(Transaction.plaid_transaction_id == plaid_transaction_id)
    )
    if tx:
        db.session.delete(tx)


### ACCOUNT MANAGEMENT ENDPOINTS

@app.get("/accounts")
@login_required
def get_accounts():
    items = db.session.scalars(
        select(PlaidItem).where(PlaidItem.user_id == current_user.id)
    ).all()
    accounts_data = []
    for item in items:
        tx_count = db.session.scalar(
            select(func.count(Transaction.id)).where(Transaction.plaid_item_id == item.id)
        ) or 0
        accounts_data.append({
            "id": item.id,
            "plaid_item_id": item.plaid_item_id,
            "institution_name": item.institution_name or "Linked Bank Account",
            "status": item.status,
            "transaction_count": tx_count,
        })
    return jsonify(accounts=accounts_data)


@app.delete("/accounts/<int:item_id>")
@login_required
def delete_account(item_id):
    item = db.session.scalar(
        select(PlaidItem).where(PlaidItem.id == item_id, PlaidItem.user_id == current_user.id)
    )
    if not item:
        return jsonify(error="Account not found"), 404

    # Remove from Plaid if possible
    try:
        access_token = decrypt(item.access_token_enc)
        client.item_remove(ItemRemoveRequest(access_token=access_token))
    except Exception as e:
        app.logger.warning(f"Could not remove item from Plaid: {e}")

    db.session.delete(item)
    db.session.commit()
    return jsonify(success=True)


### ANALYTICS ENDPOINTS

@app.get("/analytics/spending_by_vendor")
@login_required
def spending_by_vendor():
    days_param = request.args.get("days", default=30, type=int)
    cutoff_date = date.today() - timedelta(days=days_param) if days_param > 0 else None

    query = (
        select(
            Transaction.merchant_name,
            func.sum(Transaction.amount_cents).label("total_cents"),
            func.count(Transaction.id).label("count"),
        )
        .where(Transaction.user_id == current_user.id)
        .where(Transaction.amount_cents > 0)  # Positive in Plaid = expenses
    )

    if cutoff_date:
        query = query.where(Transaction.date >= cutoff_date)

    query = query.group_by(Transaction.merchant_name).order_by(desc("total_cents"))

    rows = db.session.execute(query).all()

    total_sum_cents = sum(row.total_cents for row in rows) if rows else 0

    vendor_data = []
    for row in rows:
        cents = int(row.total_cents)
        dollars = round(cents / 100.0, 2)
        pct = round((cents / total_sum_cents * 100), 1) if total_sum_cents > 0 else 0
        vendor_data.append({
            "merchant_name": row.merchant_name or "Unknown Vendor",
            "total_cents": cents,
            "total_dollars": dollars,
            "transaction_count": row.count,
            "percentage": pct,
        })

    return jsonify({
        "days": days_param,
        "total_spent_cents": total_sum_cents,
        "total_spent_dollars": round(total_sum_cents / 100.0, 2),
        "vendors": vendor_data,
    })


### USER ENDPOINTS

@app.post("/create_user")
def create_user():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or len(password) < 8:
        return jsonify(error="Email and a password of 8+ characters required"), 400

    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Email already registered"), 409

    login_user(user)
    return jsonify(success=True, id=user.id, email=user.email), 201


@app.post("/login_user")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.session.scalar(select(User).where(User.email == email))
    if user is None or not check_password_hash(user.password_hash, password):
        return jsonify(error="Invalid email or password"), 401

    login_user(user)
    return jsonify(success=True, id=user.id, email=user.email)


@app.post("/logout_user")
@login_required
def logout():
    logout_user()
    return jsonify(success=True)


@app.get("/me")
@login_required
def me():
    return jsonify(id=current_user.id, email=current_user.email)


if __name__ == "__main__":
    app.run(port=5000, debug=True)