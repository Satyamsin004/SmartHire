import importlib
import pkgutil
import sys
import app

print("=== AUDITING ALL MODULE IMPORTS IN BACKEND APP ===")

missing_modules = set()

def import_submodules(package_name):
    package = sys.modules[package_name]
    for _, module_name, is_pkg in pkgutil.walk_packages(package.__path__, package.__name__ + '.'):
        try:
            importlib.import_module(module_name)
            print(f"[OK] {module_name}")
        except ModuleNotFoundError as e:
            print(f"[MISSING] {module_name} -> {e}")
            missing_modules.add(e.name)
        except Exception as e:
            print(f"[ERROR] {module_name} -> {e}")

import_submodules("app")

print("\n=========================================================================")
print(f"MISSING MODULES DETECTED: {list(missing_modules)}")
print("=========================================================================")
