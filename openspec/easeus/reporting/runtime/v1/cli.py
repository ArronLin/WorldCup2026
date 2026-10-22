"""Python 3.10+ / CI entry. No target-project Python dependencies required."""
import sys
sys.dont_write_bytecode = True
from sdd_reporting.cli import main
if __name__=='__main__': raise SystemExit(main())
