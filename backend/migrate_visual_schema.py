import sqlite3
import os

def migrate_db():
    candidates = ["smarthire.db", "backend/smarthire.db", "../smarthire.db"]
    target_dbs = [c for c in candidates if os.path.exists(c)]
    if not target_dbs:
        target_dbs = ["smarthire.db"]

    for db_path in target_dbs:
        print(f"Checking database at: {os.path.abspath(db_path)}")
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()

        # Check interview_visual_observations
        try:
            cur.execute("PRAGMA table_info(interview_visual_observations)")
            cols_obs = [r[1] for r in cur.fetchall()]
            if cols_obs:
                if "model_version" not in cols_obs:
                    cur.execute("ALTER TABLE interview_visual_observations ADD COLUMN model_version VARCHAR(50) DEFAULT 'smart-hire-behavior-v2.0'")
                    print("Added model_version to interview_visual_observations")

                if "probability_distribution" not in cols_obs:
                    cur.execute("ALTER TABLE interview_visual_observations ADD COLUMN probability_distribution JSON DEFAULT '{}'")
                    print("Added probability_distribution to interview_visual_observations")

                if "observation_status" not in cols_obs:
                    cur.execute("ALTER TABLE interview_visual_observations ADD COLUMN observation_status VARCHAR(50) DEFAULT 'VALID'")
                    print("Added observation_status to interview_visual_observations")
        except Exception as e:
            print(f"Error migrating interview_visual_observations: {e}")

        # Check interview_visual_metrics
        try:
            cur.execute("PRAGMA table_info(interview_visual_metrics)")
            cols_met = [r[1] for r in cur.fetchall()]
            if cols_met:
                if "model_version" not in cols_met:
                    cur.execute("ALTER TABLE interview_visual_metrics ADD COLUMN model_version VARCHAR(50) DEFAULT 'smart-hire-behavior-v2.0'")
                    print("Added model_version to interview_visual_metrics")
        except Exception as e:
            print(f"Error migrating interview_visual_metrics: {e}")

        conn.commit()
        conn.close()

    print("Database schema migration complete.")

if __name__ == "__main__":
    migrate_db()
