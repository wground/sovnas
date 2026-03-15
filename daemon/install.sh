#!/bin/bash
# install.sh — Install sovnas-daemon to /opt/sovnas and set up systemd service
set -e

INSTALL_DIR=/opt/sovnas
SERVICE_FILE=/etc/systemd/system/sovnas-daemon.service

echo "Installing sovnas-daemon..."
sudo mkdir -p "$INSTALL_DIR"
sudo cp noun.py sovnas-daemon.py "$INSTALL_DIR/"
sudo chmod +x "$INSTALL_DIR/sovnas-daemon.py"

echo "Installing systemd service..."
sudo cp sovnas-daemon.service "$SERVICE_FILE"
sudo systemctl daemon-reload

echo ""
echo "Done! Edit $SERVICE_FILE to set --pier and --root, then:"
echo "  sudo systemctl enable sovnas-daemon"
echo "  sudo systemctl start sovnas-daemon"
echo "  sudo systemctl status sovnas-daemon"
