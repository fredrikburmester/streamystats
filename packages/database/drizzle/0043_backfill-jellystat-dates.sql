UPDATE sessions
SET start_time = last_activity_date, end_time = last_activity_date
WHERE start_time IS NULL AND end_time IS NULL AND last_activity_date IS NOT NULL;