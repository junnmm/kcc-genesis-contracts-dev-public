/* tslint:disable */
/* eslint-disable */


import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {ReservePoolMockForValidators, Validators} from "../typechain";
import {ethers,network} from "hardhat";
import {getLastBlockInfo, mineBlocks, setBalance, setCoinbase} from "./helpers";
import {expect} from "chai";
import {BigNumber} from "ethers";

describe("Recover GoDao's funds", function () {

    let initialValidators:SignerWithAddress[]; // initiatial validators
    let initialManagers:SignerWithAddress[]; // initiatial managers
    let validatorContract: Validators; // sut
    let reservePoolMock : ReservePoolMockForValidators; // mocked reservePool
    let deployer: SignerWithAddress;
    let admin: SignerWithAddress;
    let newValidator: SignerWithAddress;

    const MAX_VALIDATORS = 29; // the max number of validators
    const INITIAL_FEE_SHARE = 2000; // initial commission fee rate for validator  20%
    const MIN_SELF_BALLOTS_IN_KCS = ethers.constants.WeiPerEther.mul(10000); // minimum Self Ballots denominated in KCS
    const MIN_SELF_BALLOTS = MIN_SELF_BALLOTS_IN_KCS.div(ethers.constants.WeiPerEther);

    beforeEach(async()=>{

        const signers = await ethers.getSigners();
        let others: SignerWithAddress[];
        [deployer, admin,  , ...others] = signers;

        validatorContract = await (await ethers.getContractFactory("Validators", deployer)).deploy()
        reservePoolMock = await (await ethers.getContractFactory("ReservePoolMockForValidators", deployer)).deploy()

        initialValidators = others.slice(0, MAX_VALIDATORS + 1); // 30 initial validators
        initialManagers = others.slice(MAX_VALIDATORS + 2, MAX_VALIDATORS*2 + 3 );


        await setBalance(
                         validatorContract.address,
                         MIN_SELF_BALLOTS_IN_KCS.mul(initialValidators.length).add(
                            // add GoDao's funds 990_000 KCS 
                            ethers.constants.WeiPerEther.mul(990_000)
                         ));
 
        // initialize for the first time
        await validatorContract.initialize(
            initialValidators.map(v => v.address),
            initialManagers.map(v => v.address),
            initialValidators.map(v => INITIAL_FEE_SHARE), // 20% feeShare
            admin.address,
            validatorContract.address,
            ethers.constants.AddressZero,
            ethers.constants.AddressZero,
            reservePoolMock.address,100);



    });

    it("only manager account can recover funds", async ()=>{
        
        await expect(
            validatorContract.connect(deployer).recoverGoDaofunds()
        ).to.revertedWith("must be admin");

    });

    it("recover GoDao's funds (not testnet)", async ()=>{

        // balance of admin before recover
        const balanceBefore = await ethers.provider.getBalance(admin.address);

        await validatorContract.connect(admin).recoverGoDaofunds({
            gasPrice: 0  // zero gas price 
        });

        // check the balance 
        const balanceAfter = await ethers.provider.getBalance(admin.address);


        expect(balanceAfter).to.be.equal(balanceBefore.add( ethers.constants.WeiPerEther.mul(990_000)));
    });

    it("should only recover once", async ()=>{

        // recover for the first time 
        await validatorContract.connect(admin).recoverGoDaofunds({
            gasPrice: 0  // zero gas price 
        });

        // revert when recover for the second time 
        await expect(
            validatorContract.connect(admin).recoverGoDaofunds({
                gasPrice: 0  // zero gas price
            })
        ).to.revertedWith("already recovered");


    });

});