# BPSR-PSO

**Forked from:** https://github.com/dmlgzs/StarResonanceDamageCounter

Blue Protocol: Star Resonance - Per Second Overlay
Provides a useful GUI to track DPS / HPS / DMG Taken for nearby players

## About the Project

This is a standalone application and does not interface with BPSR or modify any of its files. It analyzes packet while in transit.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You'll need to have the following software installed:

- **Node.js**: <https://nodejs.org/>
- **npm**: Comes bundled with Node.js.
- **Libpcap**: Install libpcap, for Arch Linux: `yay -S libpcap`

### Installation Methods

**_Compiling from source:_**

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/backaround/BPSR-PSO.git
    ```

2.  **Navigate into the project directory:**

    ```bash
    cd BPSR-PSO
    ```

3.  **Install Node.js dependencies:**

    ```bash
    npm install
    ```

4.  **Giving permission:**
    ```bash
    sudo setcap cap_net_raw,cap_net_admin=eip node_modules/electron/dist/electron
    getcap node_modules/electron/dist/electron
    ```
5.  **Verify:**
    ```bash
    getcap node_modules/electron/dist/electron
    ```
6.  **Starting the application in the project root:**
    ```bash
    npm start
    ```

**_Using executable (prebuilt):_**

1. **Download the prebuilt on 'Releases'**

2. **Run the script to give necessary permission and execute:**
    ```bash
    chmod +x bpsr-pso.sh
    ./bpsr-pso.sh
    ```
