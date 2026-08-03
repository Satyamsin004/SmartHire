"""
SmartHire AI Platform - Production Testing Mode Cleanup Utility
Executes comprehensive cleanup of all automated testing data & files,
ensuring referential integrity and verifying zero test residue remains.
"""
import asyncio
import json
from app.core.db import AsyncSessionLocal
from app.services.cleanup_service import CleanupService

async def run_cleanup():
    print("=" * 75)
    print("=== SMARTHIRE AI: AUTOMATED TEST LIFECYCLE CLEANUP & VERIFICATION ===")
    print("=" * 75)

    async with AsyncSessionLocal() as session:
        report = await CleanupService.execute_full_cleanup(session)

    print("\n---------------------------------------------------------------------------")
    print("                         FINAL CLEANUP REPORT                              ")
    print("---------------------------------------------------------------------------")

    print("\n1. RECORDS DELETED BY TABLE:")
    for table, count in report.get("records_deleted", {}).items():
        print(f"   [DELETED] {table}: {count}")

    print(f"\n2. TABLES CLEANED ({len(report.get('tables_cleaned', []))} Total):")
    for tbl in report.get("tables_cleaned", []):
        print(f"   [CLEANED] Table '{tbl}' processed")

    print(f"\n3. FILES REMOVED ({report.get('files_removed_count', 0)} Total):")
    files_rem = report.get("files_removed", [])
    if files_rem:
        for f_path in files_rem[:10]:
            print(f"   [UNLINKED] {f_path}")
        if len(files_rem) > 10:
            print(f"   ... and {len(files_rem) - 10} more test files.")
    else:
        print("   [OK] No temporary test files found.")

    print("\n4. REMAINING PRODUCTION DATA:")
    for table, count in report.get("remaining_production_data", {}).items():
        print(f"   [PROD] {table}: {count}")

    print("\n5. VERIFICATION STATUS:")
    verifs = report.get("verification_status", {})
    all_ok = True
    labels = {
        "no_mock_candidates": "No mock candidates remain",
        "no_mock_recruiters": "No mock recruiters remain",
        "no_mock_interviews": "No mock interviews remain",
        "no_mock_ats_reports": "No mock ATS reports remain",
        "no_mock_evaluations": "No mock evaluations remain",
        "no_fake_notifications": "No fake notifications remain",
        "dashboard_stats_valid": "Dashboard statistics reflect only real users",
        "referential_integrity": "Referential integrity verified (0 orphan records)"
    }
    for k, label in labels.items():
        val = verifs.get(k, False)
        status_symbol = "[PASSED]" if val else "[FAILED]"
        print(f"   {status_symbol} {label}")
        if not val:
            all_ok = False

    print("\n===========================================================================")
    print(f"OVERALL VERIFICATION STATUS: {report.get('overall_verification', 'UNKNOWN')}")
    print("===========================================================================\n")
    return report

if __name__ == "__main__":
    asyncio.run(run_cleanup())
