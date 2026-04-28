"""seed course_opportunities and state_requirements

Revision ID: 0006_seed_opportunities_compliance
Revises: 0005_opportunities_compliance
Create Date: 2026-04-28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

revision = "0006_seed_opportunities_compliance"
down_revision = "0005_opportunities_compliance"
branch_labels = None
depends_on = None

_OPPORTUNITIES = [
    ("FL Real Estate - Fair Housing (3hr CE)", "real_estate_agent", ["FL"], 3.0, 210000, 2.0, 18.0, "low", 7, "pipeline"),
    ("FL Real Estate - Ethics (3hr CE)", "real_estate_agent", ["FL"], 3.0, 210000, 2.0, 18.0, "medium", 7, "pipeline"),
    ("TX Real Estate - Ethics (3hr CE)", "real_estate_agent", ["TX"], 3.0, 190000, 2.0, 18.0, "medium", 6, "pipeline"),
    ("FL Home Inspector - 14hr Annual CE", "home_inspector", ["FL"], 14.0, 10000, 1.0, 20.0, "low", 9, "in_progress"),
    ("FL Insurance Adjuster - CE (24hr)", "insurance_adjuster", ["FL"], 24.0, 35000, 2.0, 20.0, "low", 5, "pipeline"),
    ("CA Real Estate - Ethics (12hr)", "real_estate_agent", ["CA"], 12.0, 420000, 4.0, 15.0, "high", 6, "pipeline"),
    ("FL General Contractor - CE (14hr)", "contractor", ["FL"], 14.0, 120000, 2.0, 18.0, "low", 5, "pipeline"),
    ("FL Mortgage Broker - CE (8hr)", "mortgage_broker", ["FL"], 8.0, 45000, 2.0, 22.0, "low", 5, "pipeline"),
    ("GA Real Estate - CE (36hr)", "real_estate_agent", ["GA"], 36.0, 90000, 4.0, 16.0, "low", 6, "pipeline"),
    ("NC Real Estate - CE (8hr)", "real_estate_agent", ["NC"], 8.0, 60000, 1.0, 20.0, "low", 6, "pipeline"),
    ("FL Cosmetology - CE (16hr)", "cosmetologist", ["FL"], 16.0, 80000, 2.0, 15.0, "low", 4, "pipeline"),
    ("TX Home Inspector - CE (16hr)", "home_inspector", ["TX"], 16.0, 15000, 1.0, 20.0, "low", 8, "pipeline"),
    ("FL Real Estate Appraiser - CE (14hr)", "appraiser", ["FL"], 14.0, 8000, 2.0, 25.0, "low", 6, "pipeline"),
    ("FL Electrician - CE (17hr)", "electrician", ["FL"], 17.0, 55000, 2.0, 20.0, "low", 4, "pipeline"),
    ("OH Real Estate - CE (30hr)", "real_estate_agent", ["OH"], 30.0, 45000, 3.0, 16.0, "low", 5, "pipeline"),
]

_STATE_REQUIREMENTS = [
    ("FL", "home_inspector", "Florida DBPR", "https://www.myfloridalicense.com", True, False, 0.70, "online_portal", 30, 50.0, 1.0),
    ("TX", "home_inspector", "TREC", "https://www.trec.texas.gov", True, False, 0.70, "online_portal", 45, 30.0, 1.0),
    ("GA", "home_inspector", "Georgia Secretary of State", "https://sos.ga.gov", True, False, 0.70, "mail", 60, 0.0, 1.0),
    ("NC", "home_inspector", "NCHILB", "https://www.nchilb.org", True, False, 0.70, "online_portal", 30, 25.0, 1.0),
    ("OH", "home_inspector", "Ohio DOC", "https://com.ohio.gov", True, False, 0.75, "pdf_email", 45, 0.0, 1.0),
    ("AZ", "home_inspector", "AZBTR", "https://btr.az.gov", True, False, 0.70, "online_portal", 30, 35.0, 1.0),
    ("PA", "home_inspector", "PHIA", "https://www.phia.org", True, False, 0.70, "pdf_email", 60, 0.0, 1.0),
    ("VA", "home_inspector", "DPOR", "https://www.dpor.virginia.gov", True, False, 0.70, "online_portal", 45, 50.0, 1.0),
    ("IL", "home_inspector", "IDFPR", "https://idfpr.illinois.gov", True, False, 0.70, "online_portal", 45, 0.0, 1.0),
    ("TN", "home_inspector", "Tennessee DOC", "https://www.tn.gov/commerce", True, False, 0.70, "pdf_email", 45, 0.0, 1.0),
]


def upgrade() -> None:
    opp_table = sa.table(
        "course_opportunities",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("title", sa.String),
        sa.column("profession", sa.String),
        sa.column("target_states", postgresql.ARRAY(sa.Text())),
        sa.column("ceu_hours", sa.Float),
        sa.column("estimated_license_holders", sa.Integer),
        sa.column("renewal_frequency_years", sa.Float),
        sa.column("avg_price_per_hour", sa.Float),
        sa.column("competition_level", sa.String),
        sa.column("content_reuse_score", sa.Integer),
        sa.column("status", sa.String),
    )

    op.bulk_insert(opp_table, [
        {
            "id": uuid.uuid4(),
            "title": title,
            "profession": profession,
            "target_states": states,
            "ceu_hours": ceu_hours,
            "estimated_license_holders": holders,
            "renewal_frequency_years": renewal,
            "avg_price_per_hour": price,
            "competition_level": comp,
            "content_reuse_score": reuse,
            "status": status,
        }
        for title, profession, states, ceu_hours, holders, renewal, price, comp, reuse, status in _OPPORTUNITIES
    ])

    req_table = sa.table(
        "state_requirements",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("state_code", sa.String),
        sa.column("profession", sa.String),
        sa.column("regulatory_body", sa.String),
        sa.column("regulatory_url", sa.String),
        sa.column("online_allowed", sa.Boolean),
        sa.column("proctoring_required", sa.Boolean),
        sa.column("min_passing_score", sa.Float),
        sa.column("submission_format", sa.String),
        sa.column("processing_days", sa.Integer),
        sa.column("application_fee", sa.Float),
        sa.column("renewal_period_years", sa.Float),
    )

    op.bulk_insert(req_table, [
        {
            "id": uuid.uuid4(),
            "state_code": state_code,
            "profession": profession,
            "regulatory_body": reg_body,
            "regulatory_url": reg_url,
            "online_allowed": online,
            "proctoring_required": proctor,
            "min_passing_score": score,
            "submission_format": fmt,
            "processing_days": days,
            "application_fee": fee,
            "renewal_period_years": renewal,
        }
        for state_code, profession, reg_body, reg_url, online, proctor, score, fmt, days, fee, renewal in _STATE_REQUIREMENTS
    ])


def downgrade() -> None:
    op.execute("DELETE FROM state_requirements WHERE profession = 'home_inspector'")
    op.execute("DELETE FROM course_opportunities")
