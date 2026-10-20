from extensions import db
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

class Budget(db.Model):
    __tablename__ = "budgets"
    __table_args__ = (UniqueConstraint("user_id", "vendor", name="uq_budget_user_vendor"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    vendor: Mapped[str | None]  # None = overall/total budget
    amount_cents: Mapped[int]  # recurring monthly amount

    user: Mapped["User"] = relationship(back_populates="budgets")