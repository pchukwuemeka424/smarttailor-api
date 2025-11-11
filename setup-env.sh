#!/bin/bash

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  cat > .env << EOF
MONGODB_URI=mongodb+srv://smartTailor:IyBArPEcccCSkyLv@smarttailor.fwhnu0w.mongodb.net/smartTailor?appName=SmartTailor
PORT=3000
NODE_ENV=development
EOF
  echo ".env file created successfully!"
else
  echo ".env file already exists!"
fi

