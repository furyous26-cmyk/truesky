@echo off
cd /d "%~dp0"
echo Checking Python 3.11 Swiss Ephemeris...
py -3.11 -c "import swisseph as swe; print('Swiss OK', swe.version)" || (
  echo Installing pyswisseph in Python 3.11...
  py -3.11 -m pip install --upgrade pip setuptools wheel
  py -3.11 -m pip install pyswisseph
)
echo Installing npm packages if needed...
if not exist node_modules npm install
echo Starting site at http://localhost:5501
set PYTHON=py
set PYTHON_ARGS=-3.11
npm start
