# CCTP Analytics

## Introduction

CCTP Analytics is a TypeScript-based project designed to analyse CCTP Protocol Transaction between Solana and various EVM-compatible blockchains. The script parses transactions, calculates fees, and retrieves transaction details across multiple chains. 

## Environment Preparation

### Prerequisites

Ensure you have the following installed on your system:

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/your-repo/cctp-analytics.git
    cd cctp-analytics
    ```

2. Install the dependencies:
    ```sh
    npm install
    ```

3. Create a `.env` file in the root directory and add the following environment variables:
    ```sh
    SOLANA_RPC_URL=<your_solana_rpc_url>
    ALCHEMY_API_KEY=<your_alchemy_api_key>
    ```

## How to Run the Script

### Build and Run

1. Compile the TypeScript code:
    ```sh
    npm run build
    ```

2. Start the script:
    ```sh
    npm start
    ```

