from typing import List
from budget import Budget
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from flask_login import UserMixin
from extensions import db

class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = mapped_column(Integer, primary_key=True)
    email = mapped_column(String(255), unique=True, nullable=False)
    password_hash = mapped_column(String(255), nullable=False)
    budgets: Mapped[list["Budget"]] = relationship(back_populates="user")
    items: Mapped[List["PlaidItem"]] = relationship("PlaidItem", back_populates="user")