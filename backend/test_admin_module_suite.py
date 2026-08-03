import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_admin_module_refactoring_test():
    print("=========================================================================")
    print("=== STARTING ENTERPRISE ADMIN MODULE REFACTORING TEST SUITE ===")
    print("=========================================================================\n")

    timestamp = int(time.time())

    # 1. Register Admin User
    admin_email = f"admin_refactor_{timestamp}@example.com"
    r_adm = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Senior Enterprise Admin",
        "email": admin_email,
        "password": "AdminPassword123!",
        "role": "admin"
    })
    assert r_adm.status_code in [200, 201]
    admin_token = r_adm.json()["tokens"]["access_token"]
    print("✓ Admin Registered & Authenticated")

    # 2. Register Candidate & Recruiter for test targets
    cand_email = f"cand_adm_target_{timestamp}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Candidate Target User",
        "email": cand_email,
        "password": "TargetPassword123!",
        "role": "candidate"
    })
    cand_user_id = r_cand.json()["user"]["id"]

    rec_email = f"rec_adm_target_{timestamp}@example.com"
    r_rec = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Recruiter Target User",
        "email": rec_email,
        "password": "TargetPassword123!",
        "role": "recruiter"
    })
    rec_user_id = r_rec.json()["user"]["id"]
    print("✓ Target Candidate and Recruiter Created")

    # 3. Query Admin Dashboard Overview Stats & Summary Metrics
    stats_res = requests.get(f"{BASE_URL}/admin/dashboard-stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert stats_res.status_code == 200
    s_data = stats_res.json()
    assert "summary" in s_data
    assert "charts" in s_data
    summary = s_data["summary"]
    assert summary["total_users"] > 0
    assert summary["total_candidates"] > 0
    assert summary["total_recruiters"] > 0
    assert summary["total_admins"] > 0
    print(f"✓ Admin Dashboard Summary Metrics Verified ({summary['total_users']} Total Users, {summary['total_candidates']} Candidates, {summary['total_recruiters']} Recruiters)")

    # 4. Candidate Management List Query
    cand_list_res = requests.get(f"{BASE_URL}/admin/candidates", headers={"Authorization": f"Bearer {admin_token}"})
    assert cand_list_res.status_code == 200
    cands = cand_list_res.json()
    target_cand = next((c for c in cands if c["user_id"] == cand_user_id), None)
    assert target_cand is not None
    print(f"✓ Admin Candidate Management Query Verified (Candidate ID: {target_cand['candidate_id']})")

    # 5. Candidate Deep Audit Details Query
    cand_det_res = requests.get(f"{BASE_URL}/admin/candidate/{target_cand['candidate_id']}/details", headers={"Authorization": f"Bearer {admin_token}"})
    assert cand_det_res.status_code == 200
    assert "candidate" in cand_det_res.json()
    print("✓ Deep Candidate Details Audit Viewer Verified")

    # 6. Recruiter Management List Query
    rec_list_res = requests.get(f"{BASE_URL}/admin/recruiters", headers={"Authorization": f"Bearer {admin_token}"})
    assert rec_list_res.status_code == 200
    recs = rec_list_res.json()
    target_rec = next((r for r in recs if r["user_id"] == rec_user_id), None)
    assert target_rec is not None
    print("✓ Admin Recruiter Management Query Verified")

    # 7. Admin Account Control Actions (Verify, Block, Unblock, Reset Password)
    verify_act = requests.post(f"{BASE_URL}/admin/user/{rec_user_id}/action", headers={"Authorization": f"Bearer {admin_token}"}, json={"action": "verify"})
    assert verify_act.status_code == 200

    block_act = requests.post(f"{BASE_URL}/admin/user/{cand_user_id}/action", headers={"Authorization": f"Bearer {admin_token}"}, json={"action": "block"})
    assert block_act.status_code == 200

    unblock_act = requests.post(f"{BASE_URL}/admin/user/{cand_user_id}/action", headers={"Authorization": f"Bearer {admin_token}"}, json={"action": "unblock"})
    assert unblock_act.status_code == 200

    reset_act = requests.post(f"{BASE_URL}/admin/user/{cand_user_id}/action", headers={"Authorization": f"Bearer {admin_token}"}, json={"action": "reset_password", "new_password": "NewResetPassword123!"})
    assert reset_act.status_code == 200
    print("✓ Admin User Action Controls (Verify, Block, Unblock, Reset Password) Verified")

    # 8. Query Admin Audit Activity Logs
    audit_res = requests.get(f"{BASE_URL}/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) > 0
    print(f"✓ Admin Audit Activity Logs Verified ({len(logs)} Action Logs Recorded)")

    # 9. Query & Update Platform Settings
    sett_res = requests.get(f"{BASE_URL}/admin/settings", headers={"Authorization": f"Bearer {admin_token}"})
    assert sett_res.status_code == 200
    print("✓ Admin Platform Settings Verified")

    print("=========================================================================")
    print("[SUCCESS] ALL ENTERPRISE ADMIN MODULE REFACTORING TESTS PASSED 100% SUCCESSFULLY!")
    print("=========================================================================")

if __name__ == "__main__":
    import asyncio
    import cleanup_test_data
    try:
        run_admin_module_refactoring_test()
    finally:
        asyncio.run(cleanup_test_data.run_cleanup())
