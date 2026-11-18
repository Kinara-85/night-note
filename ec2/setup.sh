#!/bin/bash
# ============================================================
# ec2/setup.sh — Run ONCE on the EC2 server (Amazon Linux 2023).
# Installs Node.js, makes Night Note a service that starts by
# itself, and puts deploy.sh where GitHub Actions can call it.
# ============================================================
set -e

sudo dnf install -y nodejs unzip
mkdir -p ~/nightnote/data ~/nightnote/logs

# deploy.sh: GitHub Actions runs this on every deployment.
cat > ~/deploy.sh <<'EOF'
#!/bin/bash
# Usage: deploy.sh <bucket> <key>
set -e
echo "Downloading s3://$1/$2"
aws s3 cp "s3://$1/$2" /tmp/build.zip
rm -rf ~/nightnote/app_new
unzip -q /tmp/build.zip -d ~/nightnote/app_new
rm -rf ~/nightnote/app
mv ~/nightnote/app_new ~/nightnote/app
sudo systemctl restart nightnote
echo "Deployed $2"
EOF
chmod +x ~/deploy.sh

# Night Note as a service: starts on boot, restarts if it crashes.
sudo tee /etc/systemd/system/nightnote.service > /dev/null <<EOF
[Unit]
Description=Night Note
After=network.target

[Service]
User=ec2-user
WorkingDirectory=/home/ec2-user/nightnote/app
ExecStart=/usr/bin/node start.js
Environment=NN_DATA_DIR=/home/ec2-user/nightnote/data
Environment=NN_LOG_DIR=/home/ec2-user/nightnote/logs
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable nightnote
echo "Setup done."
