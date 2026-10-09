// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC2771Context} from "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title FamFi
/// @notice Family money rules for a parent, a teen, and sponsors (relatives). One contract, no admin key.
/// All USDC is held here and tracked in an internal ledger. There is intentionally NO withdraw in v1:
/// testnet USDC has no value and a closed ledger leaves no cash-out route.
/// Users act through a permissionless ERC-2771 forwarder, so a relayer pays gas and users never hold MON.
contract FamFi is ERC2771Context, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    // ───────────────────────────── types ─────────────────────────────
    enum Role { NONE, PARENT, TEEN, SPONSOR, MERCHANT }
    enum PendingKind { OVER_LIMIT, ANOMALY }
    enum PendingStatus { NONE, OPEN, EXECUTED, REJECTED, CANCELLED }
    enum RefKind { NONE, SPLIT, REQUEST }
    enum GoalStatus { NONE, PROPOSED, ACTIVE, COMPLETE, CLOSED }
    enum ReqStatus { NONE, OPEN, PAID }

    struct Account {
        Role role;
        uint32 familyId;
        uint64 linkedAt;
        bytes32 famId;
    }

    struct TeenCfg {
        uint8 level;
        bool frozen;
        bool strictHolds;
        bool leveledUp;
        uint32 holdSeconds;
        int32 tzOffset;
        uint32 dayIndex;
        uint128 spentToday;
        uint128 newPayeeThreshold;
        uint128 firstDayCap;
        uint128 roundUpUnit;
        uint256 roundUpGoal;
        uint128[4] levelLimits;
    }

    /// @notice The starting rules a parent chooses for a teen. They are signed into the invite, so the contract
    /// has no built-in numbers: every family sets its own.
    struct Terms {
        uint128[4] levelLimits; // daily limit at each level, ascending
        uint128 newPayeeThreshold; // a first payment to someone new above this is held
        uint128 firstDayCap; // in a teen's first 24 hours, a payment above this is held
        uint32 holdSeconds; // how long a held payment waits (at most 1 day)
        bool strictHolds; // true: a parent must approve every hold
    }

    struct Stream {
        uint128 remaining;
        uint128 rate; // USDC base units per second
        uint64 last;
    }

    struct Pending {
        address from;
        address to;
        uint128 amount;
        PendingKind kind;
        PendingStatus status;
        RefKind refKind;
        uint32 createdDay;
        uint64 createdAt;
        uint64 releaseAt;
        uint256 refId;
    }

    struct Goal {
        address teen;
        uint128 target;
        uint128 saved;
        uint128 matched;
        uint16 minOwnBps;
        uint64 deadline;
        GoalStatus status;
        bool sponsorOpen;
    }

    struct Gift {
        address sponsor;
        uint256 goalId;
        uint128 escrow;
        uint128 released;
        uint64 ratio; // match per 1 saved, 1e6 == 1:1
        uint64 deadline;
    }

    struct Split {
        address creator;
        uint128 perShare;
        uint32 slots;
        uint32 paid;
    }

    struct Request {
        address from; // who asked for money
        address to; // who is asked to pay
        uint128 amount;
        ReqStatus status;
    }

    // ───────────────────────────── storage ─────────────────────────────
    IERC20 public immutable token;

    uint256 public constant MAX_GIFTS_PER_GOAL = 5;
    uint256 public constant RATIO_ONE = 1e6;
    uint256 public constant MAX_RATIO = 10e6;

    mapping(address => Account) public accounts;
    mapping(bytes32 => address) public famIdToAddr;
    mapping(address => uint256) public balance;

    uint32 public familyCount;
    mapping(uint32 => address) public familyParent;
    mapping(uint32 => int32) public familyTz;
    mapping(bytes32 => bool) public usedInvite;

    mapping(address => TeenCfg) internal teenCfg;
    mapping(address => Stream) public streams;
    mapping(address => mapping(address => bool)) public paidBefore;

    uint256 public pendingCount;
    mapping(uint256 => Pending) public pendings;

    uint256 public goalCount;
    mapping(uint256 => Goal) public goals;
    mapping(uint256 => uint256[]) internal goalGifts;

    uint256 public giftCount;
    mapping(uint256 => Gift) public gifts;

    uint256 public splitCount;
    mapping(uint256 => Split) public splits;
    mapping(uint256 => mapping(address => bool)) public splitPaidBy;

    uint256 public requestCount;
    mapping(uint256 => Request) public requests;

    bytes32 private constant INVITE_TYPEHASH = keccak256(
        "Invite(uint32 familyId,bytes32 inviteId,uint256 deadline,uint128[4] levelLimits,uint128 newPayeeThreshold,uint128 firstDayCap,uint32 holdSeconds,bool strictHolds)"
    );

    // ───────────────────────────── events ─────────────────────────────
    event FamIdRegistered(address indexed user, bytes32 indexed famId, Role role);
    event FamilyCreated(uint32 indexed familyId, address indexed parent, int32 tzOffset);
    event TeenAdded(address indexed teen, bytes32 indexed famId, uint32 indexed familyId);
    event Deposited(address indexed by, address indexed user, uint256 amount);
    event StreamFunded(address indexed teen, uint128 budget, uint128 rate, uint128 remaining);
    event Paid(address indexed from, address indexed to, uint256 amount, string memo);
    event PaymentHeld(uint256 indexed id, address indexed from, address indexed to, uint256 amount, PendingKind kind, uint64 releaseAt, RefKind refKind, uint256 refId, string memo);
    event PendingResolved(uint256 indexed id, PendingStatus outcome);
    event LimitsSet(address indexed teen, uint128[4] levelLimits, uint128 newPayeeThreshold, uint128 firstDayCap, uint32 holdSeconds, bool strictHolds);
    event Frozen(address indexed teen);
    event Unfrozen(address indexed teen);
    event RoundUpSet(address indexed teen, uint128 unit, uint256 goalId);
    event GoalProposed(uint256 indexed goalId, address indexed teen, uint128 target, uint64 deadline, string memo);
    event GoalApproved(uint256 indexed goalId, bool sponsorOpen);
    event GiftLocked(uint256 indexed giftId, uint256 indexed goalId, address indexed sponsor, uint128 amount, uint64 ratio, uint64 deadline);
    event GoalSaved(uint256 indexed goalId, address indexed teen, uint128 amount, uint128 saved, uint128 matched);
    event GiftReleased(uint256 indexed giftId, uint256 indexed goalId, uint128 amount);
    event GoalCompleted(uint256 indexed goalId, uint128 total);
    event LevelUp(address indexed teen, uint8 newLevel);
    event GiftReclaimed(uint256 indexed giftId, address indexed sponsor, uint128 amount);
    event GoalClosed(uint256 indexed goalId, uint128 returned);
    event GoalSpent(uint256 indexed goalId, address indexed teen, address indexed to, uint128 amount);
    event SplitCreated(uint256 indexed splitId, address indexed creator, uint128 perShare, uint32 slots, string memo);
    event SplitSharePaid(uint256 indexed splitId, address indexed payer, uint32 paidCount);
    event RequestCreated(uint256 indexed requestId, address indexed from, address indexed to, uint128 amount, string memo);
    event RequestPaid(uint256 indexed requestId);

    constructor(IERC20 token_, address trustedForwarder_)
        ERC2771Context(trustedForwarder_)
        EIP712("FamFi", "1")
    {
        token = token_;
    }

    // ───────────────────────────── setup ─────────────────────────────

    /// @notice Pick a Fam-ID and a non-teen role. Teens can only join through a parent invite.
    function register(bytes32 famId, Role role) external {
        require(role == Role.PARENT || role == Role.SPONSOR || role == Role.MERCHANT, "role not allowed");
        _register(_msgSender(), famId, role, 0);
    }

    function createFamily(int32 tzOffset) external returns (uint32 familyId) {
        address parent = _msgSender();
        Account storage a = accounts[parent];
        require(a.role == Role.PARENT, "not parent");
        require(a.familyId == 0, "has family");
        require(tzOffset >= -12 hours && tzOffset <= 14 hours, "bad tz");
        familyId = ++familyCount;
        familyParent[familyId] = parent;
        familyTz[familyId] = tzOffset;
        a.familyId = familyId;
        emit FamilyCreated(familyId, parent, tzOffset);
    }

    /// @notice Join a family as a teen. `parentSig` is the parent's EIP-712 signature over the invite.
    /// The invite is bearer: whoever submits it first with a valid signature becomes the teen.
    function acceptInvite(
        uint32 familyId,
        bytes32 inviteId,
        uint256 deadline,
        Terms calldata terms,
        bytes calldata parentSig,
        bytes32 famId
    ) external {
        require(block.timestamp <= deadline, "invite expired");
        require(!usedInvite[inviteId], "invite used");
        address parent = familyParent[familyId];
        require(parent != address(0), "no family");
        _checkTerms(terms);
        require(ECDSA.recover(_inviteDigest(familyId, inviteId, deadline, terms), parentSig) == parent, "bad invite sig");
        usedInvite[inviteId] = true;

        address teen = _msgSender();
        _register(teen, famId, Role.TEEN, familyId);

        TeenCfg storage c = teenCfg[teen];
        c.tzOffset = familyTz[familyId];
        c.levelLimits = terms.levelLimits;
        c.newPayeeThreshold = terms.newPayeeThreshold;
        c.firstDayCap = terms.firstDayCap;
        c.holdSeconds = terms.holdSeconds;
        c.strictHolds = terms.strictHolds;
        c.dayIndex = _today(c.tzOffset);
        emit TeenAdded(teen, famId, familyId);
        emit LimitsSet(teen, terms.levelLimits, terms.newPayeeThreshold, terms.firstDayCap, terms.holdSeconds, terms.strictHolds);
    }

    // ───────────────────────────── money in ─────────────────────────────

    /// @notice Pull USDC from the caller into `user`'s ledger balance. The treasury uses this to fund demo users.
    function depositFor(address user, uint256 amount) external nonReentrant {
        require(accounts[user].role != Role.NONE, "unknown user");
        require(amount > 0, "zero");
        balance[user] += amount;
        token.safeTransferFrom(_msgSender(), address(this), amount);
        emit Deposited(_msgSender(), user, amount);
    }

    /// @notice Parent earmarks `budget` from their balance for a teen's allowance, streamed at `rate` per second.
    /// Accrued money belongs to the teen and is settled automatically on every teen action.
    function fundStream(address teen, uint128 budget, uint128 rate) external {
        address parent = _msgSender();
        _requireParentOf(parent, teen);
        require(budget > 0 && rate > 0, "zero");
        require(balance[parent] >= budget, "insufficient");
        _settle(teen);
        balance[parent] -= budget;
        Stream storage s = streams[teen];
        s.remaining += budget;
        s.rate = rate;
        s.last = uint64(block.timestamp);
        emit StreamFunded(teen, budget, rate, s.remaining);
    }

    // ───────────────────────────── parent controls ─────────────────────────────

    function setLimits(
        address teen,
        uint128[4] calldata levelLimits,
        uint128 newPayeeThreshold,
        uint128 firstDayCap,
        uint32 holdSeconds,
        bool strictHolds
    ) external {
        _requireParentOf(_msgSender(), teen);
        require(levelLimits[0] > 0, "set a daily limit");
        for (uint256 i = 1; i < 4; i++) require(levelLimits[i] >= levelLimits[i - 1], "limits not ascending");
        require(holdSeconds <= 1 days, "hold too long");
        TeenCfg storage c = teenCfg[teen];
        c.levelLimits = levelLimits;
        c.newPayeeThreshold = newPayeeThreshold;
        c.firstDayCap = firstDayCap;
        c.holdSeconds = holdSeconds;
        c.strictHolds = strictHolds;
        emit LimitsSet(teen, levelLimits, newPayeeThreshold, firstDayCap, holdSeconds, strictHolds);
    }

    function freeze(address teen) external {
        _requireParentOf(_msgSender(), teen);
        teenCfg[teen].frozen = true;
        emit Frozen(teen);
    }

    function unfreeze(address teen) external {
        _requireParentOf(_msgSender(), teen);
        teenCfg[teen].frozen = false;
        emit Unfrozen(teen);
    }

    // ───────────────────────────── payments ─────────────────────────────

    /// @notice Pay a Fam-ID. A teen's payment may be held (over limit, or flagged as unusual).
    function pay(bytes32 famId, uint128 amount, string calldata memo) external nonReentrant returns (uint256 pendingId) {
        address to = famIdToAddr[famId];
        require(to != address(0), "unknown fam-id");
        return _pay(_msgSender(), to, amount, RefKind.NONE, 0, memo);
    }

    function approvePending(uint256 id) external nonReentrant {
        Pending storage p = pendings[id];
        require(p.status == PendingStatus.OPEN, "not open");
        _requireParentOf(_msgSender(), p.from);
        _executePending(id, p);
    }

    function rejectPending(uint256 id) external nonReentrant {
        Pending storage p = pendings[id];
        require(p.status == PendingStatus.OPEN, "not open");
        _requireParentOf(_msgSender(), p.from);
        _unwindPending(id, p, PendingStatus.REJECTED);
    }

    /// @notice After the hold ends, the teen can release an ANOMALY hold unless strict holds are on.
    function finalizePending(uint256 id) external nonReentrant {
        Pending storage p = pendings[id];
        require(p.status == PendingStatus.OPEN, "not open");
        require(p.from == _msgSender(), "not payer");
        require(p.kind == PendingKind.ANOMALY, "needs parent");
        TeenCfg storage c = teenCfg[p.from];
        require(!c.strictHolds, "strict holds");
        require(!c.frozen, "frozen");
        require(block.timestamp >= p.releaseAt, "still held");
        _executePending(id, p);
    }

    /// @notice The payer can always take back a payment that is still held.
    function cancelPending(uint256 id) external nonReentrant {
        Pending storage p = pendings[id];
        require(p.status == PendingStatus.OPEN, "not open");
        require(p.from == _msgSender(), "not payer");
        _unwindPending(id, p, PendingStatus.CANCELLED);
    }

    /// @notice Teen sets spare-change saving: each direct payment is rounded up to `unit` and the difference goes to the goal.
    function setRoundUp(uint128 unit, uint256 goalId) external {
        address teen = _msgSender();
        require(accounts[teen].role == Role.TEEN, "not teen");
        if (goalId != 0) require(goals[goalId].teen == teen, "not your goal");
        TeenCfg storage c = teenCfg[teen];
        c.roundUpUnit = unit;
        c.roundUpGoal = goalId;
        emit RoundUpSet(teen, unit, goalId);
    }

    // ───────────────────────────── goals and matched gifts ─────────────────────────────

    function proposeGoal(uint128 target, uint64 deadline, uint16 minOwnBps, string calldata memo)
        external
        returns (uint256 goalId)
    {
        address teen = _msgSender();
        require(accounts[teen].role == Role.TEEN, "not teen");
        require(target > 0, "zero");
        require(deadline > block.timestamp, "bad deadline");
        require(minOwnBps <= 10000, "bad bps");
        goalId = ++goalCount;
        goals[goalId] = Goal(teen, target, 0, 0, minOwnBps, deadline, GoalStatus.PROPOSED, false);
        emit GoalProposed(goalId, teen, target, deadline, memo);
    }

    function approveGoal(uint256 goalId, bool sponsorOpen) external {
        Goal storage g = goals[goalId];
        require(g.status == GoalStatus.PROPOSED, "not proposed");
        _requireParentOf(_msgSender(), g.teen);
        g.status = GoalStatus.ACTIVE;
        g.sponsorOpen = sponsorOpen;
        emit GoalApproved(goalId, sponsorOpen);
    }

    /// @notice A sponsor (or the parent) escrows `amount`. Each 1 the teen saves releases `ratio/1e6` of it into the goal.
    function lockMatch(uint256 goalId, uint128 amount, uint64 ratio, uint64 deadline)
        external
        nonReentrant
        returns (uint256 giftId)
    {
        address sponsor = _msgSender();
        Goal storage g = goals[goalId];
        require(g.status == GoalStatus.ACTIVE, "goal not active");
        require(block.timestamp < g.deadline, "goal ended");
        Role r = accounts[sponsor].role;
        bool isParent = r == Role.PARENT && familyParent[accounts[g.teen].familyId] == sponsor;
        require(isParent || (r == Role.SPONSOR && g.sponsorOpen), "not allowed");
        require(amount > 0, "zero");
        require(ratio > 0 && ratio <= MAX_RATIO, "bad ratio");
        require(deadline > block.timestamp, "bad deadline");
        require(goalGifts[goalId].length < MAX_GIFTS_PER_GOAL, "too many gifts");
        require(balance[sponsor] >= amount, "insufficient");

        balance[sponsor] -= amount;
        giftId = ++giftCount;
        gifts[giftId] = Gift(sponsor, goalId, amount, 0, ratio, deadline);
        goalGifts[goalId].push(giftId);
        emit GiftLocked(giftId, goalId, sponsor, amount, ratio, deadline);
    }

    /// @notice Teen moves their own money into the goal; matched gift money is released in the same transaction.
    function saveToGoal(uint256 goalId, uint128 amount) external nonReentrant {
        address teen = _msgSender();
        Goal storage g = goals[goalId];
        require(g.teen == teen && g.status == GoalStatus.ACTIVE, "goal not active");
        require(amount > 0, "zero");
        _settle(teen);
        require(balance[teen] >= amount, "insufficient");
        require(amount <= g.target - g.saved - g.matched, "exceeds goal");
        _save(goalId, teen, amount);
    }

    /// @notice Spend a completed goal on a Fam-ID (e.g. the shop). Skips the daily limit; still blocked by freeze.
    function payFromGoal(uint256 goalId, bytes32 famId) external nonReentrant {
        address teen = _msgSender();
        Goal storage g = goals[goalId];
        require(g.teen == teen && g.status == GoalStatus.COMPLETE, "goal not complete");
        require(!teenCfg[teen].frozen, "frozen");
        address to = famIdToAddr[famId];
        require(to != address(0) && to != teen, "bad payee");
        uint128 total = g.saved + g.matched;
        g.status = GoalStatus.CLOSED;
        balance[to] += total;
        paidBefore[teen][to] = true;
        emit Paid(teen, to, total, "goal");
        emit GoalSpent(goalId, teen, to, total);
    }

    /// @notice After the goal's deadline an unfinished goal can be closed; the teen gets saved + matched back.
    function closeGoal(uint256 goalId) external nonReentrant {
        Goal storage g = goals[goalId];
        require(g.teen == _msgSender(), "not your goal");
        require(g.status == GoalStatus.ACTIVE, "not active");
        require(block.timestamp > g.deadline, "not ended");
        uint128 total = g.saved + g.matched;
        g.status = GoalStatus.CLOSED;
        balance[g.teen] += total;
        emit GoalClosed(goalId, total);
    }

    /// @notice Sponsor takes back unmatched escrow once the goal is done, closed, or past a deadline.
    function reclaimGift(uint256 giftId) external nonReentrant {
        Gift storage gf = gifts[giftId];
        require(gf.sponsor == _msgSender(), "not sponsor");
        Goal storage g = goals[gf.goalId];
        bool done = g.status == GoalStatus.COMPLETE || g.status == GoalStatus.CLOSED;
        require(done || block.timestamp > gf.deadline || block.timestamp > g.deadline, "gift still active");
        uint128 amt = gf.escrow;
        require(amt > 0, "nothing to reclaim");
        gf.escrow = 0;
        balance[gf.sponsor] += amt;
        emit GiftReclaimed(giftId, gf.sponsor, amt);
    }

    // ───────────────────────────── splits and requests ─────────────────────────────

    function createSplit(uint128 perShare, uint32 slots, string calldata memo) external returns (uint256 id) {
        address creator = _msgSender();
        require(accounts[creator].role != Role.NONE, "unknown user");
        require(perShare > 0 && slots > 0 && slots <= 50, "bad split");
        id = ++splitCount;
        splits[id] = Split(creator, perShare, slots, 0);
        emit SplitCreated(id, creator, perShare, slots, memo);
    }

    /// @notice A friend pays their share. The payment goes through the payer's own limits and holds.
    function paySplitShare(uint256 id) external nonReentrant {
        address payer = _msgSender();
        Split storage s = splits[id];
        require(s.creator != address(0), "no split");
        require(payer != s.creator, "creator");
        require(!splitPaidBy[id][payer], "already paid");
        require(s.paid < s.slots, "split full");
        splitPaidBy[id][payer] = true;
        s.paid += 1;
        emit SplitSharePaid(id, payer, s.paid);
        _pay(payer, s.creator, s.perShare, RefKind.SPLIT, id, "split");
    }

    function createRequest(bytes32 toFamId, uint128 amount, string calldata memo) external returns (uint256 id) {
        address from = _msgSender();
        address to = famIdToAddr[toFamId];
        require(accounts[from].role != Role.NONE, "unknown user");
        require(to != address(0) && to != from, "bad payee");
        require(amount > 0, "zero");
        id = ++requestCount;
        requests[id] = Request(from, to, amount, ReqStatus.OPEN);
        emit RequestCreated(id, from, to, amount, memo);
    }

    function payRequest(uint256 id) external nonReentrant {
        Request storage r = requests[id];
        require(r.status == ReqStatus.OPEN, "not open");
        require(r.to == _msgSender(), "not payer");
        r.status = ReqStatus.PAID;
        emit RequestPaid(id);
        _pay(r.to, r.from, r.amount, RefKind.REQUEST, id, "request");
    }

    // ───────────────────────────── views ─────────────────────────────

    function getTeenCfg(address teen) external view returns (TeenCfg memory) {
        return teenCfg[teen];
    }

    /// @notice What has streamed to the teen but is not yet in their balance (the UI ticker).
    function accrued(address teen) public view returns (uint128) {
        Stream storage s = streams[teen];
        if (s.remaining == 0 || s.last == 0) return 0;
        uint256 a = uint256(s.rate) * (block.timestamp - s.last);
        return a > s.remaining ? s.remaining : uint128(a);
    }

    /// @notice Spendable balance including what has streamed but is not yet settled.
    function spendable(address who) external view returns (uint256) {
        return balance[who] + accrued(who);
    }

    function remainingToday(address teen) external view returns (uint128) {
        TeenCfg storage c = teenCfg[teen];
        uint128 spent = c.dayIndex == _today(c.tzOffset) ? c.spentToday : 0;
        uint128 limit = c.levelLimits[c.level];
        return limit > spent ? limit - spent : 0;
    }

    function giftsOfGoal(uint256 goalId) external view returns (uint256[] memory) {
        return goalGifts[goalId];
    }

    // ───────────────────────────── internals ─────────────────────────────

    function _register(address user, bytes32 famId, Role role, uint32 familyId) internal {
        require(accounts[user].role == Role.NONE, "already registered");
        require(_validFamId(famId), "bad fam-id");
        require(famIdToAddr[famId] == address(0), "fam-id taken");
        accounts[user] = Account(role, familyId, uint64(block.timestamp), famId);
        famIdToAddr[famId] = user;
        emit FamIdRegistered(user, famId, role);
    }

    /// @dev 3 to 20 characters from [a-z0-9_], left-aligned, zero padded.
    function _validFamId(bytes32 id) internal pure returns (bool) {
        uint256 len;
        bool ended;
        for (uint256 i = 0; i < 32; i++) {
            bytes1 ch = id[i];
            if (ch == 0) {
                ended = true;
                continue;
            }
            if (ended) return false;
            bool ok = (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39) || ch == 0x5f;
            if (!ok) return false;
            len++;
        }
        return len >= 3 && len <= 20;
    }

    function _checkTerms(Terms calldata t) internal pure {
        require(t.levelLimits[0] > 0, "set a daily limit");
        for (uint256 i = 1; i < 4; i++) require(t.levelLimits[i] >= t.levelLimits[i - 1], "limits not ascending");
        require(t.holdSeconds <= 1 days, "hold too long");
    }

    function _inviteDigest(uint32 familyId, bytes32 inviteId, uint256 deadline, Terms calldata t)
        internal
        view
        returns (bytes32)
    {
        bytes32 limitsHash = keccak256(
            abi.encodePacked(uint256(t.levelLimits[0]), uint256(t.levelLimits[1]), uint256(t.levelLimits[2]), uint256(t.levelLimits[3]))
        );
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    INVITE_TYPEHASH, familyId, inviteId, deadline, limitsHash, t.newPayeeThreshold, t.firstDayCap, t.holdSeconds, t.strictHolds
                )
            )
        );
    }

    function _requireParentOf(address parent, address teen) internal view {
        Account storage a = accounts[teen];
        require(a.role == Role.TEEN && familyParent[a.familyId] == parent, "not parent of teen");
    }

    function _today(int32 tz) internal view returns (uint32) {
        return uint32(uint256(int256(block.timestamp) + int256(tz)) / 1 days);
    }

    /// @dev Move whatever has streamed into the teen's balance.
    function _settle(address teen) internal {
        Stream storage s = streams[teen];
        if (s.last == 0) return;
        uint128 a = accrued(teen);
        s.last = uint64(block.timestamp);
        if (a > 0) {
            s.remaining -= a;
            balance[teen] += a;
        }
    }

    function _pay(address from, address to, uint128 amount, RefKind refKind, uint256 refId, string memory memo)
        internal
        returns (uint256 pendingId)
    {
        require(to != address(0) && to != from, "bad payee");
        require(amount > 0, "zero");
        Account storage fa = accounts[from];
        require(fa.role != Role.NONE, "unknown user");

        if (fa.role != Role.TEEN) {
            require(balance[from] >= amount, "insufficient");
            balance[from] -= amount;
            balance[to] += amount;
            emit Paid(from, to, amount, memo);
            return 0;
        }

        _settle(from);
        TeenCfg storage c = teenCfg[from];
        require(!c.frozen, "frozen");
        require(balance[from] >= amount, "insufficient");

        uint32 today = _today(c.tzOffset);
        if (c.dayIndex != today) {
            c.dayIndex = today;
            c.spentToday = 0;
        }
        uint128 limit = c.levelLimits[c.level];
        uint128 remaining = limit > c.spentToday ? limit - c.spentToday : 0;

        // Over the limit: escrow, do not touch spentToday. Only the parent can release it.
        if (amount > remaining) {
            return _hold(from, to, amount, PendingKind.OVER_LIMIT, refKind, refId, today, 0, memo);
        }

        // Unusual: a large first payment to a new payee, or a large payment in the first 24 hours after linking.
        bool newPayee = !paidBefore[from][to] && amount > c.newPayeeThreshold;
        bool firstDay = block.timestamp < uint256(fa.linkedAt) + 1 days && amount > c.firstDayCap;
        if (newPayee || firstDay) {
            c.spentToday += amount; // counted now so many small holds cannot dodge the limit
            return _hold(from, to, amount, PendingKind.ANOMALY, refKind, refId, today, c.holdSeconds, memo);
        }

        c.spentToday += amount;
        balance[from] -= amount;
        balance[to] += amount;
        paidBefore[from][to] = true;
        emit Paid(from, to, amount, memo);
        _roundUp(from, amount);
        return 0;
    }

    function _hold(
        address from,
        address to,
        uint128 amount,
        PendingKind kind,
        RefKind refKind,
        uint256 refId,
        uint32 today,
        uint32 holdSeconds,
        string memory memo
    ) internal returns (uint256 id) {
        balance[from] -= amount;
        id = ++pendingCount;
        uint64 releaseAt = kind == PendingKind.ANOMALY ? uint64(block.timestamp + holdSeconds) : 0;
        pendings[id] = Pending(
            from, to, amount, kind, PendingStatus.OPEN, refKind, today, uint64(block.timestamp), releaseAt, refId
        );
        emit PaymentHeld(id, from, to, amount, kind, releaseAt, refKind, refId, memo);
    }

    function _executePending(uint256 id, Pending storage p) internal {
        p.status = PendingStatus.EXECUTED;
        balance[p.to] += p.amount;
        paidBefore[p.from][p.to] = true;
        emit Paid(p.from, p.to, p.amount, "");
        emit PendingResolved(id, PendingStatus.EXECUTED);
    }

    /// @dev Refund a held payment. An ANOMALY hold gives back today's limit if it is still the same day.
    function _unwindPending(uint256 id, Pending storage p, PendingStatus outcome) internal {
        p.status = outcome;
        balance[p.from] += p.amount;
        if (p.kind == PendingKind.ANOMALY) {
            TeenCfg storage c = teenCfg[p.from];
            if (c.dayIndex == p.createdDay) {
                c.spentToday = c.spentToday > p.amount ? c.spentToday - p.amount : 0;
            }
        }
        if (p.refKind == RefKind.SPLIT) {
            splitPaidBy[p.refId][p.from] = false;
            splits[p.refId].paid -= 1;
        } else if (p.refKind == RefKind.REQUEST) {
            requests[p.refId].status = ReqStatus.OPEN;
        }
        emit PendingResolved(id, outcome);
    }

    function _roundUp(address teen, uint128 amount) internal {
        TeenCfg storage c = teenCfg[teen];
        if (c.roundUpGoal == 0 || c.roundUpUnit == 0) return;
        uint128 r = amount % c.roundUpUnit;
        if (r == 0) return;
        uint128 extra = c.roundUpUnit - r;
        Goal storage g = goals[c.roundUpGoal];
        if (g.status != GoalStatus.ACTIVE || g.teen != teen) return;
        if (extra > g.target - g.saved - g.matched || balance[teen] < extra) return;
        _save(c.roundUpGoal, teen, extra);
    }

    function _save(uint256 goalId, address teen, uint128 amount) internal {
        Goal storage g = goals[goalId];
        balance[teen] -= amount;
        g.saved += amount;

        uint128 room = g.target - g.saved - g.matched;
        uint256[] storage ids = goalGifts[goalId];
        for (uint256 i = 0; i < ids.length && room > 0; i++) {
            Gift storage gf = gifts[ids[i]];
            if (gf.escrow == 0) continue;
            uint256 rel = (uint256(amount) * gf.ratio) / RATIO_ONE; // rounds down: never over-release
            if (rel > gf.escrow) rel = gf.escrow;
            if (rel > room) rel = room;
            if (rel == 0) continue;
            gf.escrow -= uint128(rel);
            gf.released += uint128(rel);
            g.matched += uint128(rel);
            room -= uint128(rel);
            emit GiftReleased(ids[i], goalId, uint128(rel));
        }
        emit GoalSaved(goalId, teen, amount, g.saved, g.matched);

        if (g.saved + g.matched >= g.target) {
            g.status = GoalStatus.COMPLETE;
            emit GoalCompleted(goalId, g.saved + g.matched);
            TeenCfg storage c = teenCfg[teen];
            // First approved goal completed with enough of the teen's own money levels the teen up once.
            if (!c.leveledUp && c.level < 3 && uint256(g.saved) * 10000 >= uint256(g.minOwnBps) * g.target) {
                c.leveledUp = true;
                c.level += 1;
                emit LevelUp(teen, c.level);
            }
        }
    }
}
