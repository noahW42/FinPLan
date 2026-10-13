from extensions import db
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import date
class Transaction(db.Model):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    plaid_item_id: Mapped[int] = mapped_column(ForeignKey("plaid_items.id"))

    plaid_transaction_id: Mapped[str] = mapped_column(unique=True)
    date: Mapped["date"]
    merchant_name: Mapped[str | None]
    amount_cents: Mapped[int]
    category: Mapped[str | None]
    pending: Mapped[bool] = mapped_column(default=False)

    item: Mapped["PlaidItem"] = relationship(back_populates="transactions")