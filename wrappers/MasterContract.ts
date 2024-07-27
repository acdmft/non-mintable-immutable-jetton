import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode } from '@ton/core';

export type MasterContractConfig = {
    total_supply: number,
    admin: Address,
    content: Cell,
    jetton_wallet: Cell
};

export function masterContractConfigToCell(config: MasterContractConfig): Cell {
    return beginCell()
        .storeCoins(config.total_supply)
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
}
