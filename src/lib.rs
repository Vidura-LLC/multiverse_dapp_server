use anchor_lang::prelude::InterfaceAccount;
use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token_2022::{self, Burn, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};
use solana_program::program::invoke;
use solana_program::program::invoke_signed; // ✅ ADD THIS
use solana_program::system_instruction; // ✅ ADD THIS

declare_id!("A5sbJW4hgVtaYU8TvfJc8bxeWsvFgapc88qX1VruTfq4");

// ==============================
// SEED CONSTANTS
// ==============================
// Define all PDA seeds as constants for consistency and maintainability
pub const SEED_STAKING_POOL: &[u8] = b"staking_pool";
pub const SEED_USER_STAKING: &[u8] = b"user_staking";
pub const SEED_ESCROW: &[u8] = b"escrow";
pub const SEED_TOURNAMENT_POOL: &[u8] = b"tournament_pool";
pub const SEED_REGISTRATION: &[u8] = b"registration";
pub const SEED_PRIZE_POOL: &[u8] = b"prize_pool";
pub const SEED_PRIZE_ESCROW: &[u8] = b"prize_escrow";
pub const SEED_REVENUE_POOL: &[u8] = b"revenue_pool";
pub const SEED_REVENUE_ESCROW: &[u8] = b"revenue_escrow";
pub const SEED_REWARD_POOL: &[u8] = b"reward_pool";
pub const SEED_REWARD_ESCROW: &[u8] = b"reward_escrow";
pub const SEED_SOL_VAULT: &[u8] = b"sol_vault";

// ==============================
// PROTOCOL LIMITS & CONSTANTS
// ==============================
// Tournament limits
pub const MAX_TOURNAMENT_PARTICIPANTS: u16 = 1000;
pub const MAX_TOURNAMENT_DURATION_DAYS: i64 = 90;
pub const MIN_TOURNAMENT_DURATION_SECONDS: i64 = 120; // 1 hour

// Fixed-point precision for reward accumulator
const ACC_PRECISION: u128 = 1_000_000_000_000; // 1e12
const BPS_DENOMINATOR: u64 = 10_000; // 100% in basis points

// Lock period multipliers in basis points
const MULTIPLIER_1M_BPS: u64 = 10_000; // 1.0x
const MULTIPLIER_3M_BPS: u64 = 12_000; // 1.2x
const MULTIPLIER_6M_BPS: u64 = 15_000; // 1.5x
const MULTIPLIER_12M_BPS: u64 = 20_000; // 2.0x

// Lock durations in seconds (dev mode - minutes)
const ONE_MONTH: i64 = 2 * 60; // 2 minutes
const THREE_MONTHS: i64 = 5 * 60; // 5 minutes
const SIX_MONTHS: i64 = 10 * 60; // 10 minutes
const TWELVE_MONTHS: i64 = 20 * 60; // 20 minutes

// Default revenue distribution percentages
pub const DEFAULT_PRIZE_PERCENTAGE: u8 = 40;
pub const DEFAULT_REVENUE_PERCENTAGE: u8 = 50;
pub const DEFAULT_STAKING_PERCENTAGE: u8 = 5;
pub const DEFAULT_BURN_PERCENTAGE: u8 = 5;

// ==============================
// TOKEN TYPE ENUM
// ==============================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TokenType {
    SPL, // SPL Token (Token-2022)
    SOL, // Native SOL
}

impl Default for TokenType {
    fn default() -> Self {
        TokenType::SPL
    }
}

// ==============================
// HELPER FUNCTIONS
// ==============================
fn lock_multiplier_bps(lock_duration: i64) -> u64 {
    if lock_duration == ONE_MONTH {
        MULTIPLIER_1M_BPS
    } else if lock_duration == THREE_MONTHS {
        MULTIPLIER_3M_BPS
    } else if lock_duration == SIX_MONTHS {
        MULTIPLIER_6M_BPS
    } else if lock_duration == TWELVE_MONTHS {
        MULTIPLIER_12M_BPS
    } else {
        MULTIPLIER_1M_BPS
    }
}

fn validate_lock_duration(lock_duration: i64) -> Result<()> {
    require!(
        lock_duration == ONE_MONTH
            || lock_duration == THREE_MONTHS
            || lock_duration == SIX_MONTHS
            || lock_duration == TWELVE_MONTHS,
        StakingError::InvalidLockDuration
    );
    Ok(())
}

#[program]
pub mod multiversed_dapp {
    use super::*;

    // ==============================
    // GLOBAL POOL INITIALIZATION
    // ==============================

    /// Initializes staking pool and escrow (for both SOL and SPL staking)
    /// PERMISSIONLESS: Admin initializes once, but can be called by any admin
    pub fn initialize_accounts(
        ctx: Context<InitializeAccounts>,
        token_type: TokenType,
    ) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;

        // Check if already initialized
        require!(
            staking_pool.total_staked == 0,
            StakingError::AlreadyInitialized
        );

        // Initialize staking pool
        staking_pool.admin = ctx.accounts.admin.key();
        staking_pool.total_staked = 0;
        staking_pool.total_weight = 0;
        staking_pool.acc_reward_per_weight = 0;
        staking_pool.epoch_index = 0;
        staking_pool.token_type = token_type;
        staking_pool.bump = ctx.bumps.staking_pool;

        match token_type {
            TokenType::SOL => {
                // For SOL staking:
                // - No escrow needed - SOL stored directly in staking_pool account
                // - No mint validation needed - we just use a dummy value
                // - Store the staking pool's own pubkey as "mint" for consistency
                staking_pool.mint = staking_pool.key();

                msg!("✅ SOL staking pool initialized (no escrow needed)");
                msg!("   Pool stores SOL directly in its account");
            }
            TokenType::SPL => {
                // For SPL staking, validate and initialize escrow

                // ✅ Validate mint is actually a mint account
                staking_pool.mint = ctx.accounts.mint.key();

                // Verify token program
                require!(
                    ctx.accounts.token_program.key() == anchor_spl::token_2022::ID,
                    StakingError::InvalidTokenProgram
                );

                // Derive the escrow PDA
                let staking_pool_key = staking_pool.key(); // ✅ Store once
                let escrow_seeds = &[SEED_ESCROW, staking_pool_key.as_ref()]; // ✅ Use variable
                let (escrow_pda, escrow_bump) =
                    Pubkey::find_program_address(escrow_seeds, ctx.program_id);

                // Verify the provided escrow account matches the PDA
                require!(
                    ctx.accounts.pool_escrow_account.key() == escrow_pda,
                    StakingError::InvalidEscrowAccount
                );

                // Calculate rent for token account
                let rent = Rent::get()?;
                let space = 165; // Token account size for Token-2022
                let lamports = rent.minimum_balance(space);

                // Create the escrow account
                invoke_signed(
                    &system_instruction::create_account(
                        ctx.accounts.admin.key,
                        &escrow_pda,
                        lamports,
                        space as u64,
                        &anchor_spl::token_2022::ID,
                    ),
                    &[
                        ctx.accounts.admin.to_account_info(),
                        ctx.accounts.pool_escrow_account.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[SEED_ESCROW, staking_pool_key.as_ref(), &[escrow_bump]]], // ✅ Use variable
                )?;

                // Initialize as token account
                let init_account_ix = spl_token_2022::instruction::initialize_account3(
                    &anchor_spl::token_2022::ID,
                    &escrow_pda,
                    &ctx.accounts.mint.key(),
                    &staking_pool.key(), // This one is fine - used immediately
                )?;

                invoke(
                    &init_account_ix,
                    &[
                        ctx.accounts.pool_escrow_account.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                    ],
                )?;

                msg!("✅ SPL staking pool and escrow initialized");
                msg!("   Mint: {}", ctx.accounts.mint.key());
                msg!("   Escrow: {}", escrow_pda);
            }
        }

        msg!(
            "✅ Staking pool initialized by admin: {}, token_type: {:?}",
            staking_pool.admin,
            token_type
        );

        Ok(())
    }
    /// Initialize global revenue pool (admin-only, one-time)
    pub fn initialize_revenue_pool(
        ctx: Context<InitializeRevenuePool>,
        token_type: TokenType,
    ) -> Result<()> {
        let revenue_pool = &mut ctx.accounts.revenue_pool;
        let admin = &ctx.accounts.admin;

        require!(
            revenue_pool.total_funds == 0,
            RevenueError::AlreadyInitialized
        );

        revenue_pool.admin = admin.key();
        revenue_pool.mint = ctx.accounts.mint.key();
        revenue_pool.total_funds = 0;
        revenue_pool.last_distribution = Clock::get()?.unix_timestamp;
        revenue_pool.token_type = token_type;
        revenue_pool.bump = ctx.bumps.revenue_pool;

        match token_type {
            TokenType::SOL => {
                revenue_pool.mint = revenue_pool.key();
                msg!("✅ SOL revenue pool initialized (no escrow needed)");
                msg!("   Pool stores SOL directly in its account");
            }
            TokenType::SPL => {
                revenue_pool.mint = ctx.accounts.mint.key();

                require!(
                    ctx.accounts.token_program.key() == anchor_spl::token_2022::ID,
                    RevenueError::InvalidTokenProgram
                );
                let revenue_pool_key = revenue_pool.key();
                let escrow_seeds = &[SEED_REVENUE_ESCROW, revenue_pool_key.as_ref()];
                let (escrow_pda, escrow_bump) =
                    Pubkey::find_program_address(escrow_seeds, ctx.program_id);

                require!(
                    ctx.accounts.revenue_escrow_account.key() == escrow_pda,
                    RevenueError::InvalidEscrowAccount
                );
                let rent = Rent::get()?;
                let space = 165;
                let lamports = rent.minimum_balance(space);

                // Create the escrow account
                invoke_signed(
                    &system_instruction::create_account(
                        ctx.accounts.admin.key,
                        &escrow_pda,
                        lamports,
                        space as u64,
                        &anchor_spl::token_2022::ID,
                    ),
                    &[
                        ctx.accounts.admin.to_account_info(),
                        ctx.accounts.revenue_escrow_account.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[
                        SEED_REVENUE_ESCROW,
                        revenue_pool_key.as_ref(),
                        &[escrow_bump],
                    ]],
                )?;

                // Initialize as token account
                let init_account_ix = spl_token_2022::instruction::initialize_account3(
                    &anchor_spl::token_2022::ID,
                    &escrow_pda,
                    &ctx.accounts.mint.key(),
                    &revenue_pool.key(),
                )?;

                invoke(
                    &init_account_ix,
                    &[
                        ctx.accounts.revenue_escrow_account.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                    ],
                )?;

                msg!("✅ SPL revenue pool and escrow initialized");
                msg!("   Mint: {}", ctx.accounts.mint.key());
                msg!("   Escrow: {}", escrow_pda);
                msg!("   Token type: {:?}", token_type);
                msg!("   Revenue pool: {}", revenue_pool.key());
                msg!("   Revenue escrow: {}", escrow_pda);
            }
        }
        msg!(
            "✅ Revenue pool initialized by admin: {}, token_type: {:?}",
            revenue_pool.admin,
            token_type
        );
        Ok(())
    }

    /// Initialize global reward pool (admin-only, one-time)
    pub fn initialize_reward_pool(
        ctx: Context<InitializeRewardPool>,
        token_type: TokenType,
    ) -> Result<()> {
        let reward_pool = &mut ctx.accounts.reward_pool;
        let admin = &ctx.accounts.admin;

        require!(
            reward_pool.total_funds == 0,
            RewardError::AlreadyInitialized
        );

        reward_pool.admin = admin.key();
        reward_pool.total_funds = 0;
        reward_pool.last_distribution = Clock::get()?.unix_timestamp;
        reward_pool.token_type = token_type;
        reward_pool.bump = ctx.bumps.reward_pool;

        match token_type {
            TokenType::SOL => {
                reward_pool.mint = reward_pool.key();
                msg!("✅ SOL reward pool initialized (no escrow needed)");
                msg!("   Pool stores SOL directly in its account");
            }
            TokenType::SPL => {
                reward_pool.mint = ctx.accounts.mint.key();

                require!(
                    ctx.accounts.token_program.key() == anchor_spl::token_2022::ID,
                    RewardError::InvalidTokenProgram
                );

                let reward_pool_key = reward_pool.key();
                let escrow_seeds = &[SEED_REWARD_ESCROW, reward_pool_key.as_ref()];
                let (escrow_pda, escrow_bump) =
                    Pubkey::find_program_address(escrow_seeds, ctx.program_id);

                require!(
                    ctx.accounts.reward_escrow_account.key() == escrow_pda,
                    RewardError::InvalidEscrowAccount
                );

                let rent = Rent::get()?;
                let space = 165;
                let lamports = rent.minimum_balance(space);

                // Create the escrow account
                invoke_signed(
                    &system_instruction::create_account(
                        ctx.accounts.admin.key,
                        &escrow_pda,
                        lamports,
                        space as u64,
                        &anchor_spl::token_2022::ID,
                    ),
                    &[
                        ctx.accounts.admin.to_account_info(),
                        ctx.accounts.reward_escrow_account.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[SEED_REWARD_ESCROW, reward_pool_key.as_ref(), &[escrow_bump]]],
                )?;

                // Initialize as token account
                let init_account_ix = spl_token_2022::instruction::initialize_account3(
                    &anchor_spl::token_2022::ID,
                    &escrow_pda,
                    &ctx.accounts.mint.key(),
                    &reward_pool.key(),
                )?;

                invoke(
                    &init_account_ix,
                    &[
                        ctx.accounts.reward_escrow_account.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                    ],
                )?;

                msg!("✅ SPL reward pool and escrow initialized");
                msg!("   Mint: {}", ctx.accounts.mint.key());
                msg!("   Escrow: {}", escrow_pda);
            } // ✅ ADD THIS: Closes the SPL arm of the match
        } // ✅ This closes the match statement

        msg!(
            "✅ Reward pool initialized by admin: {}, token_type: {:?}",
            reward_pool.admin,
            token_type
        );

        Ok(())
    }

    // ==============================
    // STAKING FUNCTIONS
    // ==============================

    /// Stake tokens with a specified lock duration
    /// PERMISSIONLESS: Any user can stake
    pub fn stake(ctx: Context<Stake>, amount: u64, lock_duration: i64) -> Result<()> {
        validate_lock_duration(lock_duration)?;

        let staking_pool = &mut ctx.accounts.staking_pool;
        let user_staking_account = &mut ctx.accounts.user_staking_account;

        let multiplier_bps = lock_multiplier_bps(lock_duration);
        let new_weight = (amount as u128)
            .saturating_mul(multiplier_bps as u128)
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(StakingError::MathOverflow)?;

        if user_staking_account.staked_amount > 0 {
            let accumulated_per_user: u128 = user_staking_account
                .weight
                .saturating_mul(staking_pool.acc_reward_per_weight)
                .checked_div(ACC_PRECISION)
                .unwrap_or(0);
            let pending_now: u128 =
                accumulated_per_user.saturating_sub(user_staking_account.reward_debt);
            if pending_now > 0 {
                let add: u64 = pending_now.min(u128::from(u64::MAX)) as u64;
                user_staking_account.pending_rewards =
                    user_staking_account.pending_rewards.saturating_add(add);
            }
        }

        user_staking_account.owner = ctx.accounts.user.key();
        user_staking_account.staked_amount = user_staking_account
            .staked_amount
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        user_staking_account.stake_timestamp = Clock::get()?.unix_timestamp;
        user_staking_account.lock_duration = lock_duration;
        user_staking_account.weight = user_staking_account
            .weight
            .checked_add(new_weight)
            .ok_or(StakingError::MathOverflow)?;
        user_staking_account.reward_debt = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);

        staking_pool.total_staked = staking_pool
            .total_staked
            .checked_add(amount)
            .ok_or(StakingError::MathOverflow)?;
        staking_pool.total_weight = staking_pool
            .total_weight
            .checked_add(new_weight)
            .ok_or(StakingError::MathOverflow)?;

        match staking_pool.token_type {
            TokenType::SOL => {
                // ✅ Verify the pool_escrow_account is the correct SOL vault PDA
                let staking_pool_key = staking_pool.key();
                let sol_vault_seeds = &[SEED_SOL_VAULT, staking_pool_key.as_ref()];
                let (sol_vault_pda, _bump) =
                    Pubkey::find_program_address(sol_vault_seeds, ctx.program_id);

                require!(
                    ctx.accounts.pool_escrow_account.key() == sol_vault_pda,
                    StakingError::InvalidEscrowAccount
                );

                // Transfer SOL to vault using System Program
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.user.to_account_info(),
                            to: ctx.accounts.pool_escrow_account.to_account_info(),
                        },
                    ),
                    amount,
                )?;

                msg!("✅ {} lamports SOL staked to vault", amount);
                msg!("   From: {}", ctx.accounts.user.key());
                msg!("   To SOL Vault: {}", sol_vault_pda);
            }
            TokenType::SPL => {
                let mint_data = ctx.accounts.mint.try_borrow_data()?;
                let mint = Mint::try_deserialize(&mut &mint_data[..])?;
                let mint_decimals = mint.decimals;

                token_2022::transfer_checked(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.user_token_account.to_account_info(),
                            to: ctx.accounts.pool_escrow_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            authority: ctx.accounts.user.to_account_info(),
                        },
                    ),
                    amount,
                    mint_decimals,
                )?;

                msg!("✅ {} SPL tokens staked", amount);
            }
        }

        msg!(
            "✅ {} tokens staked by user: {} for {} seconds (weight: {}, multiplier: {}x)",
            amount,
            ctx.accounts.user.key(),
            lock_duration,
            new_weight,
            multiplier_bps as f64 / BPS_DENOMINATOR as f64
        );

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let user_staking_account = &mut ctx.accounts.user_staking_account;
        let staking_pool = &mut ctx.accounts.staking_pool;

        require!(
            user_staking_account.staked_amount > 0,
            StakingError::InsufficientStakedBalance
        );

        let amount_in_base_units = user_staking_account.staked_amount;

        let accumulated_per_user: u128 = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);
        let pending_now: u128 =
            accumulated_per_user.saturating_sub(user_staking_account.reward_debt);
        if pending_now > 0 {
            let add: u64 = pending_now.min(u128::from(u64::MAX)) as u64;
            user_staking_account.pending_rewards =
                user_staking_account.pending_rewards.saturating_add(add);
        }

        match staking_pool.token_type {
            TokenType::SOL => {
                // ✅ Verify the pool_escrow_account is the correct SOL vault PDA
                let staking_pool_key = staking_pool.key();
                let sol_vault_seeds = &[SEED_SOL_VAULT, staking_pool_key.as_ref()];
                let (sol_vault_pda, sol_vault_bump) =
                    Pubkey::find_program_address(sol_vault_seeds, ctx.program_id);

                require!(
                    ctx.accounts.pool_escrow_account.key() == sol_vault_pda,
                    StakingError::InvalidEscrowAccount
                );

                // ✅ Use System Program transfer with PDA signer (not direct lamport manipulation)
                let vault_signer_seeds =
                    &[SEED_SOL_VAULT, staking_pool_key.as_ref(), &[sol_vault_bump]];
                let signer_seeds: &[&[&[u8]]] = &[vault_signer_seeds];

                system_program::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.pool_escrow_account.to_account_info(),
                            to: ctx.accounts.user.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    amount_in_base_units,
                )?;

                msg!(
                    "✅ {} lamports SOL unstaked from vault",
                    amount_in_base_units
                );
                msg!("   From SOL Vault: {}", sol_vault_pda);
                msg!("   To: {}", ctx.accounts.user.key());
            }
            TokenType::SPL => {
                let mint_data = ctx.accounts.mint.try_borrow_data()?;
                let mint = Mint::try_deserialize(&mut &mint_data[..])?;
                let mint_decimals = mint.decimals;

                let staking_pool_admin = staking_pool.admin;
                let token_type_seed = [staking_pool.token_type as u8];
                let staking_pool_bump = staking_pool.bump;
                let staking_pool_seeds = &[
                    SEED_STAKING_POOL,
                    staking_pool_admin.as_ref(),
                    token_type_seed.as_ref(),
                    &[staking_pool_bump],
                ];
                let signer_seeds: &[&[&[u8]]] = &[staking_pool_seeds];

                token_2022::transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.pool_escrow_account.to_account_info(),
                            to: ctx.accounts.user_token_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            authority: staking_pool.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    amount_in_base_units,
                    mint_decimals,
                )?;

                msg!("✅ {} SPL tokens unstaked", amount_in_base_units);
            }
        }

        user_staking_account.staked_amount = 0;
        staking_pool.total_staked = staking_pool
            .total_staked
            .checked_sub(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;

        staking_pool.total_weight = staking_pool
            .total_weight
            .saturating_sub(user_staking_account.weight);
        user_staking_account.weight = 0;
        user_staking_account.reward_debt = 0;

        msg!(
            "✅ User {} unstaked all tokens. Pending rewards: {}",
            ctx.accounts.user.key(),
            user_staking_account.pending_rewards
        );

        Ok(())
    }

    /// Accrue rewards for the user (updates pending_rewards)
    /// PERMISSIONLESS: User accrues their own rewards
    pub fn accrue_rewards(ctx: Context<AccrueRewards>) -> Result<()> {
        let staking_pool = &ctx.accounts.staking_pool;
        let user_staking_account = &mut ctx.accounts.user_staking_account;

        // Calculate accumulated rewards
        let accumulated: u128 = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);

        let pending_now: u128 = accumulated.saturating_sub(user_staking_account.reward_debt);

        if pending_now > 0 {
            let add: u64 = pending_now.min(u128::from(u64::MAX)) as u64;
            user_staking_account.pending_rewards =
                user_staking_account.pending_rewards.saturating_add(add);
            user_staking_account.reward_debt = accumulated;

            msg!(
                "✅ Rewards accrued for user {}: {} (pending total: {})",
                ctx.accounts.user.key(),
                add,
                user_staking_account.pending_rewards
            );
        } else {
            msg!(
                "ℹ️ No new rewards to accrue for user {}",
                ctx.accounts.user.key()
            );
        }

        Ok(())
    }

    /// Claim accumulated rewards
    /// PERMISSIONLESS: User claims their own rewards
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        let reward_pool = &mut ctx.accounts.reward_pool;
        let user_staking_account = &mut ctx.accounts.user_staking_account;

        // Compute claimable based on accumulator
        let accumulated: u128 = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);
        let claimable_u128: u128 = accumulated
            .saturating_sub(user_staking_account.reward_debt)
            .saturating_add(user_staking_account.pending_rewards as u128);
        let claimable: u64 = claimable_u128.min(u128::from(u64::MAX)) as u64;

        require!(claimable > 0, StakingError::InsufficientStakedBalance);

        // Ensure RewardPool has sufficient funds
        require!(
            reward_pool.total_funds >= claimable,
            TournamentError::InsufficientFunds
        );

        // Transfer rewards based on token type
        match reward_pool.token_type {
            TokenType::SOL => {
                // Transfer SOL from reward pool to user
                let reward_pool_info = reward_pool.to_account_info();
                let user_info = ctx.accounts.user.to_account_info();

                **reward_pool_info.try_borrow_mut_lamports()? = reward_pool_info
                    .lamports()
                    .checked_sub(claimable)
                    .ok_or(StakingError::MathOverflow)?;

                **user_info.try_borrow_mut_lamports()? = user_info
                    .lamports()
                    .checked_add(claimable)
                    .ok_or(StakingError::MathOverflow)?;

                msg!("✅ User claimed {} lamports SOL rewards", claimable);
            }
            TokenType::SPL => {
                // Transfer SPL tokens from reward escrow
                let decimals = ctx.accounts.mint.decimals;
                let reward_admin = reward_pool.admin;
                let reward_bump = reward_pool.bump;
                let reward_pool_seeds = &[SEED_REWARD_POOL, reward_admin.as_ref(), &[reward_bump]];
                let signer_seeds: &[&[&[u8]]] = &[reward_pool_seeds];

                token_2022::transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.reward_escrow_account.to_account_info(),
                            to: ctx.accounts.user_token_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            authority: reward_pool.to_account_info(),
                        },
                        signer_seeds,
                    ),
                    claimable,
                    decimals,
                )?;

                msg!("✅ User claimed {} SPL token rewards", claimable);
            }
        }

        // Update accounting
        reward_pool.total_funds = reward_pool.total_funds.saturating_sub(claimable);
        user_staking_account.pending_rewards = 0;
        user_staking_account.reward_debt = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);

        msg!(
            "✅ User {} claimed {} rewards",
            ctx.accounts.user.key(),
            claimable
        );

        Ok(())
    }

    // ==============================
    // TOURNAMENT FUNCTIONS
    // ==============================

    pub fn create_tournament_pool(
        ctx: Context<CreateTournamentPool>,
        tournament_id: String,
        entry_fee: u64,
        max_participants: u16,
        end_time: i64,
        token_type: TokenType,
    ) -> Result<()> {
        let tournament_pool = &mut ctx.accounts.tournament_pool;
        let creator = &ctx.accounts.creator;

        // Validate tournament parameters
        require!(entry_fee > 0, TournamentError::InvalidEntryFee);
        require!(
            max_participants > 0 && max_participants <= MAX_TOURNAMENT_PARTICIPANTS,
            TournamentError::InvalidMaxParticipants
        );

        let current_time = Clock::get()?.unix_timestamp;
        require!(end_time > current_time, TournamentError::InvalidEndTime);
        require!(
            end_time < current_time + (MAX_TOURNAMENT_DURATION_DAYS * 24 * 60 * 60),
            TournamentError::InvalidEndTime
        );

        // Convert tournament_id to a fixed-size byte array
        let mut tournament_id_bytes = [0u8; 32];
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(32);
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);

        // Initialize tournament pool fields
        tournament_pool.admin = creator.key();
        tournament_pool.tournament_id = tournament_id_bytes;
        tournament_pool.entry_fee = entry_fee;
        tournament_pool.total_funds = 0;
        tournament_pool.participant_count = 0;
        tournament_pool.max_participants = max_participants;
        tournament_pool.end_time = end_time;
        tournament_pool.is_active = true;
        tournament_pool.token_type = token_type;
        tournament_pool.bump = ctx.bumps.tournament_pool;

        match token_type {
            TokenType::SOL => {
                // For SOL tournaments - no escrow needed
                tournament_pool.mint = tournament_pool.key();

                msg!("✅ SOL tournament pool created (no escrow needed)");
                msg!("   Pool stores SOL directly in its account");
            }
            TokenType::SPL => {
                // For SPL tournaments - create and initialize escrow
                tournament_pool.mint = ctx.accounts.mint.key();

                require!(
                    ctx.accounts.token_program.key() == anchor_spl::token_2022::ID,
                    TournamentError::InvalidTokenProgram
                );

                let tournament_pool_key = tournament_pool.key();
                let escrow_seeds = &[SEED_ESCROW, tournament_pool_key.as_ref()];
                let (escrow_pda, escrow_bump) =
                    Pubkey::find_program_address(escrow_seeds, ctx.program_id);

                require!(
                    ctx.accounts.pool_escrow_account.key() == escrow_pda,
                    TournamentError::InvalidEscrowAccount
                );

                let rent = Rent::get()?;
                let space = 165;
                let lamports = rent.minimum_balance(space);

                // ✅ Get mutable reference for CPI
                let escrow_account_info = ctx.accounts.pool_escrow_account.to_account_info();

                invoke_signed(
                    &system_instruction::create_account(
                        ctx.accounts.creator.key,
                        &escrow_pda,
                        lamports,
                        space as u64,
                        &anchor_spl::token_2022::ID,
                    ),
                    &[
                        ctx.accounts.creator.to_account_info(),
                        escrow_account_info.clone(), // This is now mutable in the CPI context
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[SEED_ESCROW, tournament_pool_key.as_ref(), &[escrow_bump]]],
                )?;

                let init_account_ix = spl_token_2022::instruction::initialize_account3(
                    &anchor_spl::token_2022::ID,
                    &escrow_pda,
                    &ctx.accounts.mint.key(),
                    &tournament_pool.key(),
                )?;

                invoke(
                    &init_account_ix,
                    &[escrow_account_info, ctx.accounts.mint.to_account_info()],
                )?;

                msg!("✅ SPL tournament pool and escrow initialized");
                msg!("   Mint: {}", ctx.accounts.mint.key());
                msg!("   Escrow: {}", escrow_pda);
            }
        }

        msg!(
        "✅ Tournament pool created by {}: ID={}, entry_fee={}, max_participants={}, token_type={:?}",
        creator.key(),
        String::from_utf8_lossy(&tournament_id_bytes),
        entry_fee,
        max_participants,
        token_type
    );

        Ok(())
    }
    /// Register for tournament
    /// PERMISSIONLESS: Any user can register
    pub fn register_for_tournament(
        ctx: Context<RegisterForTournament>,
        _tournament_id: String,
    ) -> Result<()> {
        let tournament_pool = &mut ctx.accounts.tournament_pool;
        let registration_account = &mut ctx.accounts.registration_account;

        // Verify tournament is active
        require!(
            tournament_pool.is_active,
            TournamentError::TournamentNotActive
        );

        // Verify tournament hasn't ended
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time < tournament_pool.end_time,
            TournamentError::TournamentEnded
        );

        // Verify tournament isn't full
        require!(
            tournament_pool.participant_count < tournament_pool.max_participants,
            TournamentError::TournamentFull
        );

        let entry_fee = tournament_pool.entry_fee;

        // Transfer entry fee based on token type
        match tournament_pool.token_type {
            TokenType::SOL => {
                // ✅ Use System Program transfer for SOL
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.user.to_account_info(),
                            to: tournament_pool.to_account_info(),
                        },
                    ),
                    entry_fee,
                )?;

                msg!("✅ {} lamports SOL transferred as entry fee", entry_fee);
            }
            TokenType::SPL => {
                // ✅ Validate token program is correct
                require!(
                    ctx.accounts.token_program.key() == anchor_spl::token_2022::ID,
                    TournamentError::InvalidTokenProgram
                );

                // ✅ Validate escrow account
                let tournament_pool_key = tournament_pool.key();
                let escrow_seeds = &[SEED_ESCROW, tournament_pool_key.as_ref()];
                let (escrow_pda, _bump) =
                    Pubkey::find_program_address(escrow_seeds, ctx.program_id);

                require!(
                    ctx.accounts.pool_escrow_account.key() == escrow_pda,
                    TournamentError::InvalidEscrowAccount
                );

                // Transfer SPL tokens from user to tournament escrow
                let mint_data = ctx.accounts.mint.try_borrow_data()?;
                let mint = Mint::try_deserialize(&mut &mint_data[..])?;
                let mint_decimals = mint.decimals;

                token_2022::transfer_checked(
                    CpiContext::new(
                        ctx.accounts.token_program.to_account_info(),
                        TransferChecked {
                            from: ctx.accounts.user_token_account.to_account_info(),
                            to: ctx.accounts.pool_escrow_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            authority: ctx.accounts.user.to_account_info(),
                        },
                    ),
                    entry_fee,
                    mint_decimals,
                )?;

                msg!("✅ {} SPL tokens transferred as entry fee", entry_fee);
            }
        }

        // Update tournament pool
        tournament_pool.total_funds += entry_fee;
        tournament_pool.participant_count += 1;

        // Initialize registration record
        registration_account.user = ctx.accounts.user.key();
        registration_account.tournament_pool = tournament_pool.key();
        registration_account.is_initialized = true;
        registration_account.registration_time = current_time;
        registration_account.bump = ctx.bumps.registration_account;

        msg!(
            "✅ User {} registered for tournament {} with {} tokens",
            ctx.accounts.user.key(),
            String::from_utf8_lossy(&tournament_pool.tournament_id),
            entry_fee
        );

        Ok(())
    }
    /// Initialize prize pool for a tournament
    /// Initialize prize pool for a tournament
    /// Can be called by tournament creator or auto-initialized
    pub fn initialize_prize_pool(
        ctx: Context<InitializePrizePool>,
        _tournament_id: String,
    ) -> Result<()> {
        let prize_pool = &mut ctx.accounts.prize_pool;
        let creator = &ctx.accounts.creator;
        let tournament_pool = &ctx.accounts.tournament_pool;

        // Use tournament_id from tournament_pool (already validated in Context)
        let tournament_id_bytes = tournament_pool.tournament_id;

        // Initialize prize pool basic fields
        prize_pool.admin = creator.key();
        prize_pool.tournament_pool = tournament_pool.key();
        prize_pool.tournament_id = tournament_id_bytes;
        prize_pool.total_funds = 0;
        prize_pool.distributed = false;
        prize_pool.token_type = tournament_pool.token_type;
        prize_pool.bump = ctx.bumps.prize_pool;

        // Handle token-type-specific initialization
        match tournament_pool.token_type {
            TokenType::SOL => {
                // For SOL, no escrow needed - use prize_pool pubkey as mint
                prize_pool.mint = prize_pool.key();

                msg!("✅ SOL prize pool initialized (no escrow needed)");
                msg!(
                    "   Tournament: {}",
                    String::from_utf8_lossy(&tournament_id_bytes)
                );
            }
            TokenType::SPL => {
                // For SPL, initialize escrow account
                prize_pool.mint = ctx.accounts.mint.key();

                // Validate token program
                require!(
                    ctx.accounts.token_program.key() == anchor_spl::token_2022::ID,
                    TournamentError::InvalidTokenProgram
                );

                // Validate escrow PDA
                let prize_pool_key = prize_pool.key();
                let escrow_seeds = &[SEED_PRIZE_ESCROW, prize_pool_key.as_ref()];
                let (escrow_pda, escrow_bump) =
                    Pubkey::find_program_address(escrow_seeds, ctx.program_id);

                require!(
                    ctx.accounts.prize_escrow_account.key() == escrow_pda,
                    TournamentError::InvalidEscrowAccount
                );

                // Create the escrow account
                let rent = Rent::get()?;
                let space = 165; // Token account size
                let lamports = rent.minimum_balance(space);

                invoke_signed(
                    &system_instruction::create_account(
                        ctx.accounts.creator.key,
                        &escrow_pda,
                        lamports,
                        space as u64,
                        &anchor_spl::token_2022::ID,
                    ),
                    &[
                        ctx.accounts.creator.to_account_info(),
                        ctx.accounts.prize_escrow_account.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                    ],
                    &[&[SEED_PRIZE_ESCROW, prize_pool_key.as_ref(), &[escrow_bump]]],
                )?;

                // Initialize as token account
                let init_account_ix = spl_token_2022::instruction::initialize_account3(
                    &anchor_spl::token_2022::ID,
                    &escrow_pda,
                    &ctx.accounts.mint.key(),
                    &prize_pool.key(),
                )?;

                invoke(
                    &init_account_ix,
                    &[
                        ctx.accounts.prize_escrow_account.to_account_info(),
                        ctx.accounts.mint.to_account_info(),
                    ],
                )?;

                msg!("✅ SPL prize pool and escrow initialized");
                msg!(
                    "   Tournament: {}",
                    String::from_utf8_lossy(&tournament_id_bytes)
                );
                msg!("   Mint: {}", ctx.accounts.mint.key());
                msg!("   Escrow: {}", escrow_pda);
            }
        }

        Ok(())
    }

    // ==============================
    // REVENUE DISTRIBUTION FUNCTIONS
    // ==============================

    pub fn distribute_tournament_revenue(
        ctx: Context<DistributeTournamentRevenue>,
        tournament_id: String,
        prize_percentage: u8,
        revenue_percentage: u8,
        staking_percentage: u8,
        burn_percentage: u8,
    ) -> Result<()> {
        // Validate percentages sum to 100
        let total = prize_percentage
            .checked_add(revenue_percentage)
            .and_then(|sum| sum.checked_add(staking_percentage))
            .and_then(|sum| sum.checked_add(burn_percentage))
            .ok_or(TournamentError::MathOverflow)?;

        require!(total == 100, TournamentError::InvalidPercentages);

        let tournament_pool = &mut ctx.accounts.tournament_pool;

        // Verify tournament has ended
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= tournament_pool.end_time,
            TournamentError::TournamentNotActive
        );

        // Verify tournament is still active (not already distributed)
        require!(
            tournament_pool.is_active,
            TournamentError::TournamentNotActive
        );

        let total_funds = tournament_pool.total_funds;
        require!(total_funds > 0, TournamentError::InsufficientFunds);

        // ✅ REMOVED: Prize pool initialization logic - it should already exist

        // Calculate distribution amounts
        let prize_amount = (total_funds as u128)
            .saturating_mul(prize_percentage as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        let revenue_amount = (total_funds as u128)
            .saturating_mul(revenue_percentage as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        let staking_amount = (total_funds as u128)
            .saturating_mul(staking_percentage as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        let burn_amount = (total_funds as u128)
            .saturating_mul(burn_percentage as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        // Prepare signer seeds for tournament pool
        let creator_key = tournament_pool.admin;
        let tournament_id_bytes = tournament_id.as_bytes(); // ✅ Use the actual string bytes
        let token_type_seed = [tournament_pool.token_type as u8];
        let bump = tournament_pool.bump;

        let tournament_seeds = &[
            SEED_TOURNAMENT_POOL,
            creator_key.as_ref(),
            tournament_id_bytes, // ✅ This now matches the backend derivation
            token_type_seed.as_ref(),
            &[bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[tournament_seeds];

        // Distribute based on token type
        match tournament_pool.token_type {
            TokenType::SOL => {
                // SOL distribution via direct lamport manipulation

                let tournament_pool_info = tournament_pool.to_account_info();

                if prize_amount > 0 {
                    **tournament_pool_info.try_borrow_mut_lamports()? -= prize_amount;
                    **ctx
                        .accounts
                        .prize_pool
                        .to_account_info()
                        .try_borrow_mut_lamports()? += prize_amount;
                    ctx.accounts.prize_pool.total_funds += prize_amount;
                }

                if revenue_amount > 0 {
                    **tournament_pool_info.try_borrow_mut_lamports()? -= revenue_amount;
                    **ctx
                        .accounts
                        .revenue_pool
                        .to_account_info()
                        .try_borrow_mut_lamports()? += revenue_amount;
                    ctx.accounts.revenue_pool.total_funds += revenue_amount;
                }

                if staking_amount > 0 {
                    **tournament_pool_info.try_borrow_mut_lamports()? -= staking_amount;
                    **ctx
                        .accounts
                        .reward_pool
                        .to_account_info()
                        .try_borrow_mut_lamports()? += staking_amount;
                    ctx.accounts.reward_pool.total_funds += staking_amount;
                }

                msg!("✅ SOL tournament revenue distributed");
            }
            TokenType::SPL => {
                // SPL token distribution
                // ✅ Get mint decimals in a limited scope
                let mint_decimals = {
                    let mint_data = ctx.accounts.mint.try_borrow_data()?;
                    let mint = Mint::try_deserialize(&mut &mint_data[..])?;
                    mint.decimals
                }; // ✅ mint_data borrow is dropped here

                // Transfer to prize pool
                if prize_amount > 0 {
                    let prize_pool = &mut ctx.accounts.prize_pool;
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                to: ctx.accounts.prize_escrow_account.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                                authority: tournament_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        prize_amount,
                        mint_decimals,
                    )?;
                    prize_pool.total_funds += prize_amount;
                }

                // Transfer to revenue pool
                if revenue_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                to: ctx.accounts.revenue_escrow_account.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                                authority: tournament_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        revenue_amount,
                        mint_decimals,
                    )?;
                    ctx.accounts.revenue_pool.total_funds += revenue_amount;
                }

                // Transfer to reward pool
                if staking_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                to: ctx.accounts.reward_escrow_account.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                                authority: tournament_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        staking_amount,
                        mint_decimals,
                    )?;
                    ctx.accounts.reward_pool.total_funds += staking_amount;

                    let staking_pool = &mut ctx.accounts.staking_pool;
                    if staking_pool.total_weight > 0 {
                        let delta: u128 = (staking_amount as u128)
                            .saturating_mul(ACC_PRECISION)
                            .checked_div(staking_pool.total_weight)
                            .unwrap_or(0);
                        staking_pool.acc_reward_per_weight =
                            staking_pool.acc_reward_per_weight.saturating_add(delta);
                    }
                }

                // Burn tokens
                if burn_amount > 0 {
                    token_2022::burn(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            Burn {
                                mint: ctx.accounts.mint.to_account_info(),
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                authority: tournament_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        burn_amount,
                    )?;
                }

                msg!("✅ SPL tournament revenue distributed");
            }
        }

        // Update tournament pool state
        tournament_pool.is_active = false;
        tournament_pool.total_funds = 0;
        ctx.accounts.revenue_pool.last_distribution = current_time;

        msg!(
            "✅ Tournament revenue distributed: Prize: {}, Revenue: {}, Staking: {}, Burned: {}",
            prize_amount,
            revenue_amount,
            staking_amount,
            burn_amount
        );

        Ok(())
    }

    /// Distribute prizes to tournament winners
    /// Only callable by tournament creator
    pub fn distribute_tournament_prizes(
        ctx: Context<DistributeTournamentPrizes>,
        tournament_id: String, // Used for verification
    ) -> Result<()> {
        // Fixed percentages for the top 3 positions
        const PERCENTAGES: [u8; 3] = [50, 30, 20]; // 1st: 50%, 2nd: 30%, 3rd: 20%

        let prize_pool = &mut ctx.accounts.prize_pool;

        // Convert tournament_id to fixed-size bytes for comparison
        let mut tournament_id_bytes = [0u8; 32];
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(32);
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);

        // Verify tournament ID matches
        require!(
            prize_pool.tournament_id == tournament_id_bytes,
            TournamentError::Unauthorized
        );

        // Ensure prize pool hasn't been distributed yet
        require!(!prize_pool.distributed, TournamentError::AlreadyDistributed);

        // Ensure there are funds to distribute
        require!(
            prize_pool.total_funds > 0,
            TournamentError::InsufficientFunds
        );

        let total_prize_pool = prize_pool.total_funds;

        // Calculate prize amounts for each winner
        let first_place_amount = (total_prize_pool as u128)
            .saturating_mul(PERCENTAGES[0] as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        let second_place_amount = (total_prize_pool as u128)
            .saturating_mul(PERCENTAGES[1] as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        let third_place_amount = (total_prize_pool as u128)
            .saturating_mul(PERCENTAGES[2] as u128)
            .checked_div(100)
            .ok_or(TournamentError::MathOverflow)? as u64;

        // Distribute based on token type
        match prize_pool.token_type {
            TokenType::SOL => {
                // SOL PRIZE DISTRIBUTION
                let prize_pool_info = prize_pool.to_account_info();
                let mut prize_pool_lamports = prize_pool_info.try_borrow_mut_lamports()?;

                require!(
                    **prize_pool_lamports >= total_prize_pool,
                    TournamentError::InsufficientFunds
                );

                // Transfer to winners
                if first_place_amount > 0 {
                    **ctx.accounts.first_place_winner.try_borrow_mut_lamports()? +=
                        first_place_amount;
                    **prize_pool_lamports -= first_place_amount;
                }

                if second_place_amount > 0 {
                    **ctx.accounts.second_place_winner.try_borrow_mut_lamports()? +=
                        second_place_amount;
                    **prize_pool_lamports -= second_place_amount;
                }

                if third_place_amount > 0 {
                    **ctx.accounts.third_place_winner.try_borrow_mut_lamports()? +=
                        third_place_amount;
                    **prize_pool_lamports -= third_place_amount;
                }

                msg!("✅ SOL tournament prizes distributed");
            }
            TokenType::SPL => {
                // SPL TOKEN PRIZE DISTRIBUTION
                let mint_decimals = ctx.accounts.mint.decimals;
                let tournament_pool_key = prize_pool.tournament_pool;
                let bump = prize_pool.bump;
                let signer_seeds: &[&[&[u8]]] =
                    &[&[SEED_PRIZE_POOL, tournament_pool_key.as_ref(), &[bump]]];

                // Transfer to 1st place
                if first_place_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.prize_escrow_account.to_account_info(),
                                to: ctx.accounts.first_place_token_account.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                                authority: prize_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        first_place_amount,
                        mint_decimals,
                    )?;
                }

                // Transfer to 2nd place
                if second_place_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.prize_escrow_account.to_account_info(),
                                to: ctx.accounts.second_place_token_account.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                                authority: prize_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        second_place_amount,
                        mint_decimals,
                    )?;
                }

                // Transfer to 3rd place
                if third_place_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.prize_escrow_account.to_account_info(),
                                to: ctx.accounts.third_place_token_account.to_account_info(),
                                mint: ctx.accounts.mint.to_account_info(),
                                authority: prize_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        third_place_amount,
                        mint_decimals,
                    )?;
                }

                msg!("✅ SPL tournament prizes distributed");
            }
        }

        // Mark prize pool as distributed
        prize_pool.distributed = true;
        prize_pool.total_funds = 0;

        msg!(
            "✅ Tournament prizes distributed: 1st: {}, 2nd: {}, 3rd: {}",
            first_place_amount,
            second_place_amount,
            third_place_amount
        );

        Ok(())
    }
}

// ==============================
// ACCOUNT CONTEXTS
// ==============================

#[derive(Accounts)]
#[instruction(token_type: TokenType)]
pub struct InitializeAccounts<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = StakingPool::LEN,
        seeds = [SEED_STAKING_POOL, admin.key().as_ref(), &[token_type as u8]],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// CHECK: For SPL, this must be a token account. For SOL, can be any account (we pass SystemProgram)
    #[account(mut)]
    pub pool_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, we pass SystemProgram.programId as dummy
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token program - only validated when token_type is SPL
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_STAKING_POOL, staking_pool.admin.as_ref(), &[staking_pool.token_type as u8]],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        init_if_needed,
        payer = user,
        space = UserStakingAccount::LEN,
        seeds = [SEED_USER_STAKING, staking_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub user_staking_account: Account<'info, UserStakingAccount>,

    /// CHECK: For SPL, this is user's token account. For SOL, dummy (SystemProgram).
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, this is staking escrow. For SOL, this is the SOL vault (no data).
    /// Must be writable for both token types.
    #[account(mut)]
    pub pool_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, dummy (SystemProgram).
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Token program - only used for SPL
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_STAKING_POOL, staking_pool.admin.as_ref(), &[staking_pool.token_type as u8]],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [SEED_USER_STAKING, staking_pool.key().as_ref(), user.key().as_ref()],
        bump,
        close = user,
        constraint = user_staking_account.owner == user.key() @ StakingError::Unauthorized
    )]
    pub user_staking_account: Account<'info, UserStakingAccount>,

    /// CHECK: For SPL, this is user's token account. For SOL, dummy (SystemProgram).
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, this is staking escrow. For SOL, this is the SOL vault (no data).
    /// Must be writable for both token types.
    #[account(mut)]
    pub pool_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, dummy (SystemProgram).
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Token program - only used for SPL
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_STAKING_POOL, staking_pool.admin.as_ref(), &[staking_pool.token_type as u8]],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [SEED_USER_STAKING, staking_pool.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = user_staking_account.owner == user.key() @ StakingError::Unauthorized
    )]
    pub user_staking_account: Account<'info, UserStakingAccount>,

    #[account(
        mut,
        seeds = [SEED_REWARD_POOL, reward_pool.admin.as_ref(), &[reward_pool.token_type as u8]],
        bump = reward_pool.bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    /// CHECK: Only used for SPL tokens
    #[account(mut)]
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: Only used for SPL tokens
    #[account(mut)]
    pub reward_escrow_account: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AccrueRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        seeds = [SEED_STAKING_POOL, staking_pool.admin.as_ref(), &[staking_pool.token_type as u8]],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [SEED_USER_STAKING, staking_pool.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = user_staking_account.owner == user.key() @ StakingError::Unauthorized
    )]
    pub user_staking_account: Account<'info, UserStakingAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tournament_id: String, entry_fee: u64, max_participants: u16, end_time: i64, token_type: TokenType)]
pub struct CreateTournamentPool<'info> {
    #[account(
        init,
        payer = creator,
        space = TournamentPool::LEN,
        seeds = [SEED_TOURNAMENT_POOL, creator.key().as_ref(), tournament_id.as_bytes(), &[token_type as u8]],
        bump
    )]
    pub tournament_pool: Account<'info, TournamentPool>,

    /// CHECK: For SPL, this will be a token account that needs to be created (mutable in CPI).
    /// For SOL, we pass SystemProgram.programId (not mutable).
    /// Mutability is enforced in function logic, not here.
    pub pool_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, we pass SystemProgram.programId as dummy
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token program - only validated when token_type is SPL
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(tournament_id: String)]
pub struct RegisterForTournament<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_TOURNAMENT_POOL, tournament_pool.admin.as_ref(), tournament_id.as_bytes(), &[tournament_pool.token_type as u8]],
        bump = tournament_pool.bump
    )]
    pub tournament_pool: Account<'info, TournamentPool>,

    #[account(
        init,
        payer = user,
        space = RegistrationRecord::LEN,
        seeds = [SEED_REGISTRATION, tournament_pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub registration_account: Account<'info, RegistrationRecord>,

    /// CHECK: Only used for SPL tokens. For SOL, we pass SystemProgram.programId (not mutable).
    pub user_token_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, this must be a valid token account. For SOL, we pass SystemProgram.programId (not used).
    pub pool_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, we pass SystemProgram.programId as dummy.
    /// Not mutable because mints are only read during transfers, not modified.
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Token program - only used for SPL
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(token_type: TokenType)]
pub struct InitializeRevenuePool<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = RevenuePool::LEN,
        seeds = [SEED_REVENUE_POOL, admin.key().as_ref(), &[token_type as u8]],
        bump
    )]
    pub revenue_pool: Account<'info, RevenuePool>,

    #[account(mut)]
    pub revenue_escrow_account: UncheckedAccount<'info>,

    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(token_type: TokenType)]
pub struct InitializeRewardPool<'info> {
    #[account(
        init_if_needed,
        payer = admin,
        space = RewardPool::LEN,
        seeds = [SEED_REWARD_POOL, admin.key().as_ref(), &[token_type as u8]],
        bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(mut)]
    pub reward_escrow_account: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(tournament_id: String)]
pub struct InitializePrizePool<'info> {
    #[account(
        init_if_needed,
        payer = creator,
        space = PrizePool::LEN,
        seeds = [SEED_PRIZE_POOL, tournament_pool.key().as_ref()],
        bump
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        mut,
        seeds = [SEED_TOURNAMENT_POOL, tournament_pool.admin.as_ref(), tournament_id.as_bytes(), &[tournament_pool.token_type as u8]],
        bump = tournament_pool.bump,
        constraint = tournament_pool.admin == creator.key() @ TournamentError::Unauthorized
    )]
    pub tournament_pool: Account<'info, TournamentPool>,

    /// CHECK: For SPL, this will be a token account. For SOL, we pass SystemProgram.programId (not used).
    pub prize_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, we pass SystemProgram.programId as dummy.
    pub mint: UncheckedAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,

    /// CHECK: Token program - only used for SPL
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(tournament_id: String, prize_percentage: u8, revenue_percentage: u8, staking_percentage: u8, burn_percentage: u8)]
pub struct DistributeTournamentRevenue<'info> {
    #[account(
        mut,
        constraint = creator.key() == tournament_pool.admin @ TournamentError::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
        mut, 
        seeds = [SEED_TOURNAMENT_POOL, creator.key().as_ref(), tournament_id.as_bytes(), &[tournament_pool.token_type as u8]],
        bump = tournament_pool.bump
    )]
    pub tournament_pool: Account<'info, TournamentPool>,

    #[account(
        mut,
        seeds = [SEED_PRIZE_POOL, tournament_pool.key().as_ref()],
        bump = prize_pool.bump
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        mut,
        seeds = [SEED_REVENUE_POOL, revenue_pool.admin.as_ref(), &[tournament_pool.token_type as u8]],
        bump = revenue_pool.bump
    )]
    pub revenue_pool: Account<'info, RevenuePool>,

    #[account(
        mut,
        seeds = [SEED_REWARD_POOL, reward_pool.admin.as_ref(), &[tournament_pool.token_type as u8]],
        bump = reward_pool.bump
    )]
    pub reward_pool: Account<'info, RewardPool>,

    #[account(
        mut,
        seeds = [SEED_STAKING_POOL, staking_pool.admin.as_ref(), &[tournament_pool.token_type as u8]],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// CHECK: For SPL, this is a token escrow. For SOL, not used (SystemProgram.programId).
    /// Remove mut constraint for UncheckedAccount
    pub tournament_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, this is a token escrow. For SOL, not used
    pub prize_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, this is a token escrow. For SOL, not used
    pub revenue_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, this is a token escrow. For SOL, not used
    pub reward_escrow_account: UncheckedAccount<'info>,

    /// CHECK: For SPL, must be valid mint. For SOL, we pass SystemProgram.programId
    pub mint: UncheckedAccount<'info>,

    /// CHECK: Token program - only used for SPL
    pub token_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
#[instruction(tournament_id: String)]
pub struct DistributeTournamentPrizes<'info> {
    #[account(
        mut,
        constraint = creator.key() == prize_pool.admin @ TournamentError::Unauthorized
    )]
    pub creator: Signer<'info>,

    #[account(
        constraint = tournament_pool.key() == prize_pool.tournament_pool @ TournamentError::Unauthorized
    )]
    pub tournament_pool: Account<'info, TournamentPool>,

    #[account(
        mut,
        seeds = [SEED_PRIZE_POOL, tournament_pool.key().as_ref()],
        bump = prize_pool.bump
    )]
    pub prize_pool: Account<'info, PrizePool>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = prize_pool
    )]
    pub prize_escrow_account: InterfaceAccount<'info, TokenAccount>,

    // Winner accounts (for SOL, these are System accounts; for SPL, ignored)
    /// CHECK: First place winner
    #[account(mut)]
    pub first_place_winner: UncheckedAccount<'info>,

    /// CHECK: Second place winner
    #[account(mut)]
    pub second_place_winner: UncheckedAccount<'info>,

    /// CHECK: Third place winner
    #[account(mut)]
    pub third_place_winner: UncheckedAccount<'info>,

    // Winner token accounts (for SPL only)
    /// CHECK: Only used for SPL tokens
    #[account(mut)]
    pub first_place_token_account: UncheckedAccount<'info>,

    /// CHECK: Only used for SPL tokens
    #[account(mut)]
    pub second_place_token_account: UncheckedAccount<'info>,

    /// CHECK: Only used for SPL tokens
    #[account(mut)]
    pub third_place_token_account: UncheckedAccount<'info>,

    #[account(mut, constraint = mint.key() == prize_pool.mint)]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

// ==============================
// ACCOUNT STRUCTS
// ==============================

#[account]
pub struct StakingPool {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub total_staked: u64,
    pub total_weight: u128,
    pub acc_reward_per_weight: u128,
    pub epoch_index: u64,
    pub token_type: TokenType,
    pub bump: u8,
}

impl StakingPool {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 16 + 16 + 8 + 1 + 1;
}

#[account]
pub struct UserStakingAccount {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub stake_timestamp: i64,
    pub lock_duration: i64,
    pub weight: u128,
    pub reward_debt: u128,
    pub pending_rewards: u64,
}

impl UserStakingAccount {
    pub const LEN: usize = 8 + 32 + 8 + 8 + 8 + 16 + 16 + 8;
}

#[account]
pub struct TournamentPool {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub tournament_id: [u8; 32],
    pub entry_fee: u64,
    pub total_funds: u64,
    pub participant_count: u16,
    pub max_participants: u16,
    pub end_time: i64,
    pub is_active: bool,
    pub token_type: TokenType,
    pub bump: u8,
}

impl TournamentPool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 2 + 2 + 8 + 1 + 1 + 1;
}

#[account]
pub struct RegistrationRecord {
    pub user: Pubkey,
    pub tournament_pool: Pubkey,
    pub is_initialized: bool,
    pub registration_time: i64,
    pub bump: u8,
}

impl RegistrationRecord {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1;
}

#[account]
pub struct PrizePool {
    pub admin: Pubkey,
    pub tournament_pool: Pubkey,
    pub mint: Pubkey,
    pub tournament_id: [u8; 32],
    pub total_funds: u64,
    pub distributed: bool,
    pub token_type: TokenType,
    pub bump: u8,
}

impl PrizePool {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 8 + 1 + 1 + 1;
}

#[account]
pub struct RevenuePool {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub total_funds: u64,
    pub last_distribution: i64,
    pub token_type: TokenType,
    pub bump: u8,
}

impl RevenuePool {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
}

#[account]
pub struct RewardPool {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub total_funds: u64,
    pub last_distribution: i64,
    pub token_type: TokenType,
    pub bump: u8,
}

impl RewardPool {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
}

// ==============================
// ERROR CODES
// ==============================

#[error_code]
pub enum TournamentError {
    #[msg("Insufficient funds to register for this tournament.")]
    InsufficientFunds,

    #[msg("Tournament is full.")]
    TournamentFull,

    #[msg("Tournament has ended.")]
    TournamentEnded,

    #[msg("Tournament is not active.")]
    TournamentNotActive,

    #[msg("User is already registered for this tournament.")]
    AlreadyRegistered,

    #[msg("Invalid entry fee.")]
    InvalidEntryFee,

    #[msg("Invalid maximum participants.")]
    InvalidMaxParticipants,

    #[msg("Invalid end time.")]
    InvalidEndTime,

    #[msg("Unauthorized action.")]
    Unauthorized,

    #[msg("Invalid winner data.")]
    InvalidWinnerData,

    #[msg("Winner percentages must sum to 100.")]
    InvalidWinnerPercentages,

    #[msg("Distribution percentages must sum to 100.")]
    InvalidPercentages,

    #[msg("Invalid tournament ID.")]
    InvalidTournamentId,

    #[msg("Math overflow occurred.")]
    MathOverflow,

    #[msg("Prize pool has already been distributed.")]
    AlreadyDistributed,
    #[msg("Invalid token program provided")]
    InvalidTokenProgram,

    #[msg("Invalid escrow account provided")]
    InvalidEscrowAccount,
}

#[error_code]
pub enum StakingError {
    #[msg("Staking Pool already initialized by this admin")]
    AlreadyInitialized,

    #[msg("Insufficient staked balance")]
    InsufficientStakedBalance,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Math overflow occurred")]
    MathOverflow,

    #[msg("Unstaking is locked - lock period not expired")]
    StakeLockActive,

    #[msg("Invalid Lock Duration, Must be 1, 3, 6 or 12 months")]
    InvalidLockDuration,

    #[msg("Invalid token program provided")]
    InvalidTokenProgram,

    #[msg("Invalid escrow account provided")]
    InvalidEscrowAccount,

    #[msg("Insufficient balance for this operation")]
    InsufficientBalance,
}
#[error_code]
pub enum RevenueError {
    #[msg("Revenue Pool already initialized")]
    AlreadyInitialized,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Math overflow occurred")]
    MathOverflow,

    #[msg("Invalid token program provided")]
    InvalidTokenProgram,

    #[msg("Invalid escrow account provided")]
    InvalidEscrowAccount,
}

#[error_code]
pub enum RewardError {
    #[msg("Reward Pool already initialized")]
    AlreadyInitialized,

    #[msg("Unauthorized access")]
    Unauthorized,

    #[msg("Math overflow occurred")]
    MathOverflow,

    #[msg("Invalid token program provided")]
    InvalidTokenProgram,

    #[msg("Invalid escrow account provided")]
    InvalidEscrowAccount,
}
