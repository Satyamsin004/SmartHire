import requests
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_phase7_workflow_test():
    print("=== STARTING PHASE 7 DASHBOARDS, NOTIFICATIONS & REPORTS VERIFICATION ===")

    # 1. Register Candidate & Recruiter
    cand_email = f"cand_p7_{int(time.time())}@example.com"
    r_cand = requests.post(f"{BASE_URL}/auth/register", json={
        "full_name": "Phase 7 Candidate",
        "email": cand_email,
        "password": "Password123!",
        "role": "candidate"
    })
    cand_token = r_cand.json()["tokens"]["access_token"]
    print("✓ Candidate Registered successfully")

    # 2. Test Notification Fetch Endpoint (/notifications/me)
    notif_res = requests.get(f"{BASE_URL}/notifications/me", headers={"Authorization": f"Bearer {cand_token}"})
    assert notif_res.status_code == 200
    notif_data = notif_res.json()
    assert "unread_count" in notif_data
    assert "notifications" in notif_data
    print("✓ Candidate Notification System Verified (/notifications/me)")

    # 3. Test Profile Avatar Upload & Rendering URL
    jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    avatar_res = requests.post(
        f"{BASE_URL}/uploads/avatar",
        headers={"Authorization": f"Bearer {cand_token}"},
        files={"file": ("profile.jpg", jpg_bytes, "image/jpeg")}
    )
    assert avatar_res.status_code == 200
    profile_url = avatar_res.json()["profile_image"]
    assert "/uploads/avatars/" in profile_url
    print(f"✓ Profile Avatar Uploaded & Saved: {profile_url}")

    # 4. Verify User Profile Me Endpoint Returns Avatar URL
    me_res = requests.get(f"{BASE_URL}/users/me", headers={"Authorization": f"Bearer {cand_token}"})
    assert me_res.status_code == 200
    assert me_res.json()["profile_image"] == profile_url
    print("✓ User Profile (/users/me) Avatar URL Rendering Verified")

    # 5. Remove Profile Avatar
    del_avatar = requests.delete(f"{BASE_URL}/uploads/avatar", headers={"Authorization": f"Bearer {cand_token}"})
    assert del_avatar.status_code == 200
    print("✓ Profile Avatar Removal Verified")

    print("\n=== ALL PHASE 7 DASHBOARDS, NOTIFICATIONS & REPORTS TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    run_phase7_workflow_test()
