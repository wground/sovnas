#!/bin/bash
# install.sh — Install sovnas-daemon to /opt/sovnas and set up systemd service
set -e

INSTALL_DIR=/opt/sovnas
SERVICE_FILE=/etc/systemd/system/sovnas-daemon.service

echo "Installing sovnas-daemon..."
sudo mkdir -p "$INSTALL_DIR"
sudo cp noun.py sovnas-daemon.py "$INSTALL_DIR/"
sudo chmod +x "$INSTALL_DIR/sovnas-daemon.py"

# Copy config template if no config exists yet
if [ ! -f "$INSTALL_DIR/sovnas.config.json" ]; then
  sudo cp ../sovnas.config.template.json "$INSTALL_DIR/sovnas.config.json"
  echo ""
  echo "  Created $INSTALL_DIR/sovnas.config.json"
  echo "  >>> Edit it with your ship name and pier path before starting! <<<"
  echo ""
else
  echo "  Config already exists at $INSTALL_DIR/sovnas.config.json (not overwritten)"
fi

echo "Installing systemd service..."
sudo cp sovnas-daemon.service "$SERVICE_FILE"
sudo systemctl daemon-reload

echo ""
echo "Done! Next steps:"
echo "  1. Edit $INSTALL_DIR/sovnas.config.json with your ship details"
echo "  2. sudo systemctl enable sovnas-daemon"
echo "  3. sudo systemctl start sovnas-daemon"
echo "  4. sudo systemctl status sovnas-daemon"
