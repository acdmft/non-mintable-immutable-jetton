import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { Op } from './JettonConstants';

export type MasterContractConfig = {
    total_supply: number,
    mintable: number,
    admin: Address,
    content: Cell,
    jetton_wallet: Cell
};

export function masterContractConfigToCell(config: MasterContractConfig): Cell {
    return beginCell()
        .storeCoins(config.total_supply)
        .storeInt(config.mintable, 32)
        .storeAddress(config.admin)
        .storeRef(config.content)
        .storeRef(config.jetton_wallet)
        .endCell();
}

export class MasterContract implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new MasterContract(address);
    }

    static createFromConfig(config: MasterContractConfig, code: Cell, workchain = 0) {
        const data = masterContractConfigToCell(config);
        const init = { code, data };
        return new MasterContract(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    static mintMessage(from: Address, to: Address, jetton_amount: bigint, forward_ton_amount: bigint, total_ton_amount: bigint, query_id: number | bigint = 0) {
		const mintMsg = beginCell().storeUint(Op.internal_transfer, 32)
                                   .storeUint(0, 64)
                                   .storeCoins(jetton_amount)
                                   .storeAddress(null)
                                   .storeAddress(from) // Response addr
                                   .storeCoins(forward_ton_amount)
                                   .storeMaybeRef(null)
                    .endCell();

        return beginCell().storeUint(Op.mint, 32).storeUint(query_id, 64) // op, queryId
                          .storeAddress(to)
                          .storeCoins(total_ton_amount)
                          .storeCoins(jetton_amount)
                          .storeRef(mintMsg)
               .endCell();
    }
    async sendMint(provider: ContractProvider, via: Sender, to: Address, jetton_amount: bigint, forward_ton_amount: bigint, total_ton_amount: bigint) {
        if(total_ton_amount <= forward_ton_amount) {
            throw new Error("Total ton amount should be > forward amount");
        }
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: MasterContract.mintMessage(this.address, to, jetton_amount, forward_ton_amount, total_ton_amount),
            value: total_ton_amount + toNano('0.015'),
        });
    }
    // CHANGE MASTER CONTRACT ADMIN
    static changeAdminMessage(newOwner: Address) {
        return beginCell().storeUint(Op.change_admin, 32).storeUint(0, 64) // op, queryId
                          .storeAddress(newOwner)
               .endCell();
    }

    async sendChangeAdmin(provider: ContractProvider, via: Sender, newOwner: Address) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: MasterContract.changeAdminMessage(newOwner),
            value: toNano("0.05"),
        });
    }

    // GETTERS 
    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(owner).endCell() }])
        return res.stack.readAddress()
    }

    async getJettonData(provider: ContractProvider) {
        let res = await provider.get('get_jetton_data', []);
        let totalSupply = res.stack.readBigNumber();
        let mintable = res.stack.readBoolean();
        let adminAddress = res.stack.readAddress();
        let content = res.stack.readCell();
        let walletCode = res.stack.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode
        };
    }

    async getJettonBalance(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_jetton_data', []);
        return res.stack.readBigNumber();
    }
}
