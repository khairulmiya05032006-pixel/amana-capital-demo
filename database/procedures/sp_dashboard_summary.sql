DELIMITER $$
DROP PROCEDURE IF EXISTS sp_dashboard_summary$$
CREATE PROCEDURE sp_dashboard_summary()
BEGIN
  -- A wrapper to return the vw_dashboard along with any dynamic stats if needed.
  -- The view handles the aggregation. This SP just standardizes the API for the admin dashboard.
  SELECT * FROM vw_dashboard LIMIT 1;
END$$
DELIMITER ;
