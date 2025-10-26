#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="./BPSR-PSO"
CHROME_SANDBOX="./chrome-sandbox"

# Check if the app binary exists
if [ ! -f "$APP_PATH" ]; then
    echo "Error: BPSR-PSO binary not found at $APP_PATH"
    exit 1
fi

check_capabilities() {
    getcap "$APP_PATH" 2>/dev/null | grep -q "cap_net_raw"
    return $?
}

fix_chrome_sandbox() {
    if [ -f "$CHROME_SANDBOX" ]; then
        OWNER=$(stat -c '%U' "$CHROME_SANDBOX" 2>/dev/null)
        PERMS=$(stat -c '%a' "$CHROME_SANDBOX" 2>/dev/null)

        if [ "$OWNER" != "root" ] || [ "$PERMS" != "4755" ]; then
            echo ""
            echo "Fixing chrome-sandbox permissions (requires sudo)..."
            sudo chown root:root "$CHROME_SANDBOX"
            sudo chmod 4755 "$CHROME_SANDBOX"

            if [ $? -eq 0 ]; then
                echo "✓ Chrome sandbox configured successfully!"
            else
                echo "✗ Failed to configure chrome-sandbox. App may not start correctly."
                return 1
            fi
        fi
    fi
    return 0
}

# Check if capabilities are already set
if check_capabilities; then
    fix_chrome_sandbox
    exec "$APP_PATH" "$@"
else
    echo "=========================================="
    echo "BPSR-PSO Packet Capture Setup"
    echo "=========================================="
    echo ""
    echo "BPSR-PSO needs packet capture permissions."
    echo ""
    echo "Choose an option:"
    echo "  1) Set capabilities (one-time, recommended)"
    echo "  2) Run with sudo (requires password each time)"
    echo "  3) Exit and set manually"
    echo ""
    read -p "Enter choice [1-3]: " choice

    case $choice in
        1)
            echo ""
            echo "Setting capabilities (requires sudo)..."
            sudo setcap cap_net_raw,cap_net_admin=eip "$APP_PATH"

            if [ $? -eq 0 ]; then
                echo "✓ Capabilities set successfully!"
                fix_chrome_sandbox
                echo "Starting BPSR-PSO..."
                exec "$APP_PATH" "$@"
            else
                echo "✗ Failed to set capabilities."
                echo "Try option 2 or run manually with sudo."
                exit 1
            fi
            ;;
        2)
            echo ""
            echo "To set capabilities manually, run:"
            echo "  sudo setcap cap_net_raw,cap_net_admin=eip \"$APP_PATH\""
            echo ""
            echo "Then run this script again."
            exit 0
            ;;
        *)
            echo "Invalid choice. Exiting."
            exit 1
            ;;
    esac
fi
