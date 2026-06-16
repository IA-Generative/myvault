"""SQLAlchemy ORM models for MyVault database tables."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


class Application(Base):
    """An application registered in MyVault (managed by admins)."""

    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    client_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    client_secret: Mapped[str] = mapped_column(String(512))
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    icon_url: Mapped[str] = mapped_column(String(512), default="")
    friendly_slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    check_connection_endpoint: Mapped[str] = mapped_column(String(512), default="")
    variable_aliases: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    created_by: Mapped[str] = mapped_column(String(255), default="")

    required_variables: Mapped[list["RequiredVariable"]] = relationship(
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="RequiredVariable.sort_order",
    )
    vault_entries: Mapped[list["UserVaultEntry"]] = relationship(
        back_populates="application", cascade="all, delete-orphan"
    )


class RequiredVariable(Base):
    """A variable definition required by an application."""

    __tablename__ = "required_variables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    app_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE")
    )
    key: Mapped[str] = mapped_column(String(255))
    label: Mapped[str] = mapped_column(String(255))
    var_type: Mapped[str] = mapped_column(String(50))
    required: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str] = mapped_column(Text, default="")
    default_value: Mapped[str] = mapped_column(Text, default="")
    choices: Mapped[list | None] = mapped_column(JSON, nullable=True)
    category: Mapped[str] = mapped_column(String(10), default="both")
    sort_order: Mapped[int] = mapped_column(default=0)

    application: Mapped["Application"] = relationship(
        back_populates="required_variables"
    )


# Types that require encryption. "totp" stores a TOTP seed (2FA shared secret).
ENCRYPTED_TYPES = {
    "secret",
    "api_key",
    "login",
    "password",
    "oauth_token",
    "certificate",
    "totp",
}

# Variable types whose stored value is a TOTP seed (a live code is derived from it).
TOTP_TYPES = {"totp"}


class UserVaultEntry(Base):
    """A user's saved credentials for a specific application."""

    __tablename__ = "user_vault_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    # The user's e-mail (lowercased), captured from the JWT on save. Lets M2M
    # tools that only know the OpenWebUI e-mail resolve the OIDC subject without
    # a Keycloak admin round-trip. Nullable: legacy rows are backfilled on the
    # user's next save.
    user_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    app_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE")
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    values: Mapped[dict] = mapped_column(JSON, default=dict)
    last_check: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    check_status: Mapped[str] = mapped_column(String(20), default="untested")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    application: Mapped["Application"] = relationship(back_populates="vault_entries")


class PersonalEntry(Base):
    """A free-form credential entry created by the user (not tied to an admin app)."""

    __tablename__ = "personal_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[str] = mapped_column(String(255), index=True)
    name: Mapped[str] = mapped_column(String(255))
    website: Mapped[str] = mapped_column(String(512), default="")
    username: Mapped[str] = mapped_column(Text, default="")
    encrypted_password: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class UserSecurity(Base):
    """Per-user security settings — currently the master password state.

    When enabled, vault entries are encrypted with a key derived from the user's
    master password; the password is never stored in clear text, only its bcrypt
    hash (for verification) and a KDF salt (for deriving the encryption key).
    """

    __tablename__ = "user_security"

    user_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    master_password_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    master_password_hash: Mapped[str] = mapped_column(Text, default="")
    master_password_salt: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
