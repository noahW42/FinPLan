from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from extensions import db

class PlaidItem(db.Model):
    __tablename__ = "plaid_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    plaid_item_id: Mapped[str] = mapped_column(unique=True)
    access_token_enc: Mapped[str]
    cursor: Mapped[str | None]

    institution_name: Mapped[str | None]
    status: Mapped[str] = mapped_column(default="active")


    user: Mapped["User"] = relationship(back_populates="items")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="item", cascade="all, delete-orphan")