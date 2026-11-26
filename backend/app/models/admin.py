from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AdminUser(Base):
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(String(240))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AdminSession(Base):
    __tablename__ = "admin_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class LoginThrottle(Base):
    __tablename__ = "admin_login_throttles"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    failures: Mapped[int] = mapped_column(Integer)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class StoreTrafficDay(Base):
    """One browser/store/shoe/kind per Tehran day; no customer IP or user-agent."""

    __tablename__ = "store_traffic_daily"
    shoe_id: Mapped[int] = mapped_column(ForeignKey("shoes.id"), primary_key=True)
    source: Mapped[str] = mapped_column(String(80), primary_key=True)
    retailer_id: Mapped[str] = mapped_column(String(120), primary_key=True)
    visitor_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_kind: Mapped[str] = mapped_column(String(12), primary_key=True)
    event_day: Mapped[date] = mapped_column(Date, primary_key=True)
    retailer_name: Mapped[str] = mapped_column(String(200))
    market: Mapped[str | None] = mapped_column(String(10))
    __table_args__ = (
        CheckConstraint("event_kind IN ('impression', 'click')", name="ck_traffic_kind"),
        Index("ix_traffic_day_source_pair", "event_day", "source", "shoe_id", "retailer_id"),
    )
