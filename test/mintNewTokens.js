import ether from './helpers/ether';
import EVMRevert from './helpers/EVMRevert';
import { increaseTimeTo, duration } from './helpers/increaseTime';
import latestTime from './helpers/latestTime';

const BigNumber = web3.BigNumber;

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const COTDAO = artifacts.require('COTDAO');
const Token = artifacts.require('COT');

contract('COTDAO', function([_, wallet]) {

  beforeEach(async function () {
    // Token config
    this.name = "CoTrader";
    this.symbol = "COT";
    this.decimals = 18;
    // ether convert 2 000 000 000 COT to 2000000000000000000000000 hex
    this.totalSupply = ether(2000000000);

    // Deploy Token
    this.token = await Token.new(
      this.name,
      this.symbol,
      this.decimals,
      this.totalSupply,
   );

     // dao config
     this.limit = ether(10000000000), // 10 000 000 000
     this.timeNow = Math.floor(Date.now() / 1000);
     this.openingdaoTime = latestTime() + duration.days(7); // 1 minute

     // Deploy COTDAO
     this.dao = await COTDAO.new(
       this.token.address,
       this.limit,
       this.openingdaoTime
    );
    // Transfer token ownership to dao
    await this.token.transferOwnership(this.dao.address);
    });

  describe('INIT with correct values', function() {
    it('totalSuply 2000000000 COT', async function() {
    const total = await this.token.totalSupply();
    total.should.be.bignumber.equal(ether(2000000000));
    });

    it('owner balance 2000000000 COT', async function() {
    const balanceOwner = await this.token.balanceOf(_);
    balanceOwner.should.be.bignumber.equal(ether(2000000000));
    });

    it('Owner DAO is _', async function() {
    const owner = await this.dao.owner();
    assert.equal(owner, _);
    });
  });

  describe('MintLimit', function() {
    it('MintLimit call owner should be fulfilled', async function() {
    await this.dao.MintLimit(wallet, ether(100)).should.be.fulfilled;
    });

    it('MintLimit call not owner should fail', async function() {
    await this.dao.MintLimit(wallet, ether(100), { from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('New Owner call MintLimit should be fulfilled', async function() {
    await this.dao.transferOwnership(wallet, { from: _ })
    await this.dao.MintLimit(wallet, ether(100), { from: wallet }).should.be.fulfilled;
    });

    it('Old Owner call MintLimit should be fail', async function() {
    await this.dao.transferOwnership(wallet, { from: _ })
    await this.dao.MintLimit(_, ether(100), { from: _ }).should.be.rejectedWith(EVMRevert);
    });

    it('Call MintLimit with input > limit should be fail', async function() {
    await this.dao.MintLimit(wallet, ether(10000000000)).should.be.rejectedWith(EVMRevert);
    });

    it('totalSuply increases after call MintLimit function', async function() {
    const before = await this.token.totalSupply();
    await this.dao.MintLimit(wallet, ether(100));
    const after = await this.token.totalSupply();
    assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });
  });

  describe('MintPercent', function() {
    it('Call MintPercent ahead of time should be fail', async function() {
    await this.dao.MintPercent(wallet).should.be.rejectedWith(EVMRevert);
    });

    it('Call MintPercent at the allowed time should be fulfilled', async function() {
    await increaseTimeTo(this.openingdaoTime);
    await this.dao.MintPercent(wallet).should.be.fulfilled;
    });

    it('Correct percent 0.1% per week first call is 2 000 000 (curent totalSupply() / 100 / 10))', async function() {
    await increaseTimeTo(this.openingdaoTime);
    const oldTotal = await this.token.totalSupply();
    await this.dao.MintPercent(wallet);
    const newTotal = await this.token.totalSupply();
    const sum = await web3.fromWei(newTotal, 'ether') - web3.fromWei(oldTotal, 'ether');
    assert.equal(sum, 2000000);
    });

    it('New Owner call dao percent should be fulfilled', async function() {
    await this.dao.transferOwnership(wallet, { from: _ })
    await increaseTimeTo(this.openingdaoTime);
    await this.dao.MintPercent(wallet, { from: wallet }).should.be.fulfilled;
    });

    it('Old Owner call dao percent should be fail', async function() {
    await this.dao.transferOwnership(wallet, { from: _ })
    await increaseTimeTo(this.openingdaoTime);
    await this.dao.MintPercent(_, { from: _ }).should.be.rejectedWith(EVMRevert);
    });

    it('totalSuply increases after call MintPercent function', async function() {
    const before = await this.token.totalSupply();
    await increaseTimeTo(this.openingdaoTime);
    await this.dao.MintPercent(wallet);
    const after = await this.token.totalSupply();
    assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });

    it('Call MintPercent double call should be fail because after the call, the time increases', async function() {
    await increaseTimeTo(this.openingdaoTime);
    await this.dao.MintPercent(wallet).should.be.fulfilled;
    await this.dao.MintPercent(wallet).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('ChanheOwner 51%', function() {
    it('Call ChanheOwner from address with balance 0 should be fail', async function() {
    await this.dao.ChangeOwnerDAO(wallet, { from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('Call ChangeOwnerDAO from owner with 0 tokens on balance should be fail', async function() {
    await this.token.transfer(wallet, ether(1000000000));
    await this.dao.ChangeOwnerDAO(wallet, { from: _ }).should.be.rejectedWith(EVMRevert);
    });

    it('Call ChanheOwner from address with balance === no more half should fail', async function() {
    await this.token.transfer(wallet, ether(1000000000));
    await this.dao.ChangeOwnerDAO(wallet, { from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('Call ChanheOwner from address with balance > totalSuply / 2 + 1 token should be fulfilled', async function() {
    await this.token.transfer(wallet, ether(1000000001));
    await this.dao.ChangeOwnerDAO(wallet, { from: wallet }).should.be.fulfilled;
    });
  });

  describe('MintLimit correct limit', function() {
    it('dao limit maximum should be true', async function() {
    const totalSuply = await this.token.totalSupply();
    await this.dao.MintLimit(wallet, ether(8000000000));
    const totalSuplyAfter = await this.token.totalSupply();
    totalSuplyAfter.should.be.bignumber.equal(ether(10000000000));
    });

    it('MintLimit maximum + 1 should fail', async function() {
    await this.dao.MintLimit(wallet, ether(8000000001)).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('transferOwnership standard openzeppelin stuff (optional)', function() {
    it('Call transferOwnership from owner should be fulfilled', async function() {
    await this.dao.transferOwnership(wallet, { from: _ }).should.be.fulfilled;
    });

    it('Call transferOwnership from NOT owner should be fail', async function() {
    await this.dao.transferOwnership(wallet, { from: wallet }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('PAUSE Token part 1', function() {
    it('Owner can dao when pause should be fulfilled', async function() {
    await this.dao.pauseDAO();
    await this.dao.MintLimit(wallet, ether(100)).should.be.fulfilled;
    });

    it('Not owner try dao when pause should be fail', async function() {
    await this.dao.pauseDAO();
    await this.dao.MintLimit(wallet, ether(100), { from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('Not owner try call pause should be fail', async function() {
    await this.dao.pauseDAO({ from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('Not owner try call unpause should be fail', async function() {
    await this.dao.pauseDAO();
    await this.dao.pauseDAO({ from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('totalSupply increase when owner call MintLimit when token pause', async function() {
    const before = await this.token.totalSupply();
    await this.dao.pauseDAO();
    await this.dao.MintLimit(wallet, ether(100));
    const after = await this.token.totalSupply();
    assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });

    it('totalSupply increase when owner call MintPercent when token pause', async function() {
    const before = await this.token.totalSupply();
    await this.dao.pauseDAO();
    await increaseTimeTo(this.openingdaoTime);
    await this.dao.MintPercent(wallet);
    const after = await this.token.totalSupply();
    assert.isTrue(web3.fromWei(after, 'ether') > web3.fromWei(before, 'ether'));
    });
  });

  describe('PAUSE Token part 2', function() {
    it('Owner DAO call pause not through contract DAO should be fail', async function() {
    await this.token.pause().should.be.rejectedWith(EVMRevert);
    });

    it('Not Owner DAO call pause not through contract DAO should be fail', async function() {
    await this.token.pause({ from: wallet }).should.be.rejectedWith(EVMRevert);
    });

    it('Owner contract try call unpause not through contract DAO should be fail', async function() {
    await this.dao.pauseDAO();
    await this.token.unpause().should.be.rejectedWith(EVMRevert);
    });

    it('Not owner try call unpause through contract DAO should be fail', async function() {
    await this.dao.pauseDAO();
    await this.token.unpause({ from: wallet }).should.be.rejectedWith(EVMRevert);
    });
  });

  describe('COT Token ownership', function() {
    it('Owner DAO contract try change token owner should be fail', async function() {
    await this.token.transferOwnership(_).should.be.rejectedWith(EVMRevert);
    });

    it('user try change token owner should be fail', async function() {
    await this.token.transferOwnership(wallet, { from:wallet }).should.be.rejectedWith(EVMRevert);
    });
  });

});
