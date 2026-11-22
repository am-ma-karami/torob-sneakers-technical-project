import uuid

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from app.core.config import ROOT
from app.db.session import Base
from app.models.catalog import Brand, Family, Shoe, Variant
from sqlalchemy import bindparam, create_engine, text


def test_upgrade_preserves_legacy_data_and_matches_models(store):
    session = store[0]
    schema = "rad_migration_" + uuid.uuid4().hex
    admin = create_engine(session.get_bind().url)
    with admin.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(admin.url, connect_args={"options": f"-c search_path={schema},public"})
    config = Config(str(ROOT / "alembic.ini"))
    try:
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "001")
            shoe = session.get(Shoe, 40586)
            family = session.get(Family, shoe.family_id)
            connection.execute(Brand.__table__.insert().values(name=shoe.brand))
            connection.execute(
                Family.__table__.insert().values(id=family.id, brand=family.brand, name=family.name)
            )
            connection.execute(
                Shoe.__table__.insert().values(
                    **{c.name: getattr(shoe, c.name) for c in Shoe.__table__.columns}
                )
            )
            variant = session.query(Variant).filter_by(shoe_id=40586).first()
            connection.execute(
                Variant.__table__.insert().values(shoe_id=40586, key=variant.key, payload=variant.payload)
            )
            payload = dict(
                retailer="RunningXpert",
                variant_key=variant.key,
                price=96,
                currency="EUR",
                country="DE",
                url="https://runningxpert.com/product",
                source="RunRepeat",
                snapshot="2026-11-20T10:00:00Z",
            )
            from sqlalchemy.dialects.postgresql import JSONB

            insert_legacy = text(
                "INSERT INTO offers (shoe_id,key,payload) VALUES (40586,:key,:payload)"
            ).bindparams(bindparam("payload", type_=JSONB))
            connection.execute(insert_legacy, {"key": "rr-0", "payload": payload})
            connection.execute(insert_legacy, {"key": "rr-1", "payload": dict(payload, price=-1)})
        with engine.begin() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            assert connection.scalar(text("SELECT count(*) FROM offers")) == 2
            assert connection.scalar(text("SELECT count(*) FROM offer_listings")) == 1
            assert connection.scalar(text("SELECT count(*) FROM offer_rejections")) == 1
            assert connection.scalar(text("SELECT count(*) FROM offer_observations")) == 1
            assert connection.scalar(text("SELECT count(*) FROM source_products")) == 1
            assert connection.scalar(text("SELECT owner FROM variants")) == "catalog"
            differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
            assert differences == []
            command.upgrade(config, "head")  # Safe to run deployment migration twice.
    finally:
        engine.dispose()
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()
