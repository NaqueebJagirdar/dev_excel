from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = 'ea21830eccf5'
down_revision = '02fe023f8b3b'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('sheet_data', sa.Column('comments', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('sheet_data', 'comments')
