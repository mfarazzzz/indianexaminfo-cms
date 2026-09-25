-- Requirement 8.7: Activity feed performance index
CREATE INDEX idx_entity_activity_log_recent 
  ON entity_activity_log(created_at DESC) 
  WHERE action IN ('module_filled', 'module_updated');;
