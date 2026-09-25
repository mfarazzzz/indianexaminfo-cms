-- Add self-referential parent_id for hierarchical conducting bodies
-- Allows: AIIMS (parent) → AIIMS New Delhi, AIIMS Jodhpur (children)
-- IIM (parent) → IIM Indore, IIM Rohtak (children)
ALTER TABLE conducting_body ADD COLUMN parent_id uuid REFERENCES conducting_body(id);

-- Index for efficient child lookups
CREATE INDEX idx_conducting_body_parent ON conducting_body(parent_id) WHERE parent_id IS NOT NULL;;
