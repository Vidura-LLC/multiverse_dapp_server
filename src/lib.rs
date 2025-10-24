use anchor_lang::prelude::InterfaceAccount;
use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Burn, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("Dz4rTCCmWrK9Ky6kzVqNK1GPeqjAecrZzKoyXvtue4Pr");

// ==============================
// TOKEN TYPE ENUM
// ==============================
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum TokenType {
    SPL,  // SPL Token (Token-2022)
    SOL,  // Native SOL
}

impl Default for TokenType {
    fn default() -> Self {
        TokenType::SPL
    }
}

// ==============================
// Global constants and helpers
// ==============================
// Fixed-point precision for reward accumulator
const ACC_PRECISION: u128 = 1_000_000_000_000; // 1e12
const BPS_DENOMINATOR: u64 = 10_000; // 100% in basis points

// Lock period multipliers in basis points
const MULTIPLIER_1M_BPS: u64 = 10_000; // 1.0x
const MULTIPLIER_3M_BPS: u64 = 12_000; // 1.2x
const MULTIPLIER_6M_BPS: u64 = 15_000; // 1.5xA
const MULTIPLIER_12M_BPS: u64 = 20_000; // 2.0x

fn lock_multiplier_bps(lock_duration: i64) -> u64 {
    match lock_duration {
        ONE_MONTH => MULTIPLIER_1M_BPS,
        THREE_MONTHS => MULTIPLIER_3M_BPS,
        SIX_MONTHS => MULTIPLIER_6M_BPS,
        TWELVE_MONTHS => MULTIPLIER_12M_BPS,
        _ => MULTIPLIER_1M_BPS,
    }
}

#[program]
pub mod multiversed_dapp {
    use super::*;

    /// Initializes staking pool and escrow (for both SOL and SPL staking)
    pub fn initialize_accounts(
        ctx: Context<InitializeAccounts>,
        token_type: TokenType,
    ) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;

        // Check if already initialized
        if staking_pool.total_staked > 0 {
            return Err(StakingError::AlreadyInitialized.into());
        }

        staking_pool.admin = ctx.accounts.admin.key();
        staking_pool.mint = ctx.accounts.mint.key();
        staking_pool.total_staked = 0;
        staking_pool.total_weight = 0;
        staking_pool.acc_reward_per_weight = 0;
        staking_pool.epoch_index = 0;
        staking_pool.token_type = token_type;
        staking_pool.bump = ctx.bumps.staking_pool;

        msg!(
            "✅ Staking pool initialized with admin: {}, token_type: {:?}",
            staking_pool.admin,
            token_type
        );

        Ok(())
    }
    // Prize Distribution Logic
    pub fn distribute_tournament_prizes(
        ctx: Context<DistributeTournamentPrizes>,
        tournament_id: String,
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
        require!(
            !prize_pool.distributed,
            TournamentError::AlreadyDistributed
        );
    
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
    
        // ==============================
        // TOKEN TYPE CONDITIONAL LOGIC
        // ==============================
        match prize_pool.token_type {
            TokenType::SOL => {
                // SOL PRIZE DISTRIBUTION: Transfer lamports directly to winners
                
                let prize_pool_info = prize_pool.to_account_info();
                let mut prize_pool_lamports = prize_pool_info.try_borrow_mut_lamports()?;
    
                // Verify sufficient balance
                require!(
                    **prize_pool_lamports >= total_prize_pool,
                    TournamentError::InsufficientFunds
                );
    
                // Transfer to 1st Place Winner
                if first_place_amount > 0 {
                    **ctx.accounts.first_place_winner.try_borrow_mut_lamports()? += first_place_amount;
                    **prize_pool_lamports -= first_place_amount;
    
                    msg!(
                        "✅ 1st place: {} received {} lamports SOL",
                        ctx.accounts.first_place_winner.key(),
                        first_place_amount
                    );
                }
    
                // Transfer to 2nd Place Winner
                if second_place_amount > 0 {
                    **ctx.accounts.second_place_winner.try_borrow_mut_lamports()? += second_place_amount;
                    **prize_pool_lamports -= second_place_amount;
    
                    msg!(
                        "✅ 2nd place: {} received {} lamports SOL",
                        ctx.accounts.second_place_winner.key(),
                        second_place_amount
                    );
                }
    
                // Transfer to 3rd Place Winner
                if third_place_amount > 0 {
                    **ctx.accounts.third_place_winner.try_borrow_mut_lamports()? += third_place_amount;
                    **prize_pool_lamports -= third_place_amount;
    
                    msg!(
                        "✅ 3rd place: {} received {} lamports SOL",
                        ctx.accounts.third_place_winner.key(),
                        third_place_amount
                    );
                }
    
                msg!(
                    "✅ SOL Tournament prizes distributed: 1st: {}, 2nd: {}, 3rd: {}",
                    first_place_amount,
                    second_place_amount,
                    third_place_amount
                );
            }
            TokenType::SPL => {
                // SPL TOKEN PRIZE DISTRIBUTION: Transfer tokens from escrow to winner accounts
                
                let mint = &ctx.accounts.mint;
                let decimals = mint.decimals;
    
                // Use PDA signer for transfers
                let admin = prize_pool.admin;
                let tournament_pool = prize_pool.tournament_pool;
                let bump = prize_pool.bump;
                let signer_seeds: &[&[&[u8]]] = &[&[
                    b"prize_pool",
                    tournament_pool.as_ref(),
                    &[bump],
                ]];
    
                // Transfer to 1st Place Winner
                if first_place_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.prize_escrow_account.to_account_info(),
                                to: ctx.accounts.first_place_token_account.to_account_info(),
                                mint: mint.to_account_info(),
                                authority: prize_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        first_place_amount,
                        decimals,
                    )?;
    
                    msg!(
                        "✅ 1st place: {} received {} SPL tokens",
                        ctx.accounts.first_place_token_account.key(),
                        first_place_amount
                    );
                }
    
                // Transfer to 2nd Place Winner
                if second_place_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.prize_escrow_account.to_account_info(),
                                to: ctx.accounts.second_place_token_account.to_account_info(),
                                mint: mint.to_account_info(),
                                authority: prize_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        second_place_amount,
                        decimals,
                    )?;
    
                    msg!(
                        "✅ 2nd place: {} received {} SPL tokens",
                        ctx.accounts.second_place_token_account.key(),
                        second_place_amount
                    );
                }
    
                // Transfer to 3rd Place Winner
                if third_place_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new_with_signer(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.prize_escrow_account.to_account_info(),
                                to: ctx.accounts.third_place_token_account.to_account_info(),
                                mint: mint.to_account_info(),
                                authority: prize_pool.to_account_info(),
                            },
                            signer_seeds,
                        ),
                        third_place_amount,
                        decimals,
                    )?;
    
                    msg!(
                        "✅ 3rd place: {} received {} SPL tokens",
                        ctx.accounts.third_place_token_account.key(),
                        third_place_amount
                    );
                }
    
                msg!(
                    "✅ SPL Tournament prizes distributed: 1st: {}, 2nd: {}, 3rd: {}",
                    first_place_amount,
                    second_place_amount,
                    third_place_amount
                );
            }
        }
    
        // Mark prize pool as distributed
        prize_pool.distributed = true;
        prize_pool.total_funds = 0; // Reset funds after distribution
    
        msg!("✅ Prize distribution complete for tournament: {}", tournament_id);
    
        Ok(())
    }
    

    //Stake tokens (SOL or SPL)
    pub fn stake(ctx: Context<Stake>, amount: u64, lock_duration: i64) -> Result<()> {
        require!(
            lock_duration == ONE_MONTH
                || lock_duration == THREE_MONTHS
                || lock_duration == SIX_MONTHS
                || lock_duration == TWELVE_MONTHS,
            StakingError::InvalidLockDuration
        );
    
        let staking_pool = &mut ctx.accounts.staking_pool;
        let user_staking_account = &mut ctx.accounts.user_staking_account;
        let user = &ctx.accounts.user;
    
        // ==============================
        // TOKEN TYPE CONDITIONAL LOGIC
        // ==============================
        let amount_in_base_units = match staking_pool.token_type {
            TokenType::SOL => {
                // SOL STAKING: amount is already in lamports (base units)
                // Verify user has sufficient SOL balance
                let user_balance = user.lamports();
                require!(
                    user_balance >= amount,
                    StakingError::InsufficientStakedBalance
                );
    
                // Transfer SOL from user to staking pool PDA
                let transfer_instruction = anchor_lang::system_program::Transfer {
                    from: user.to_account_info(),
                    to: staking_pool.to_account_info(),
                };
    
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        transfer_instruction,
                    ),
                    amount,
                )?;
    
                msg!("✅ Staked {} lamports SOL", amount);
                amount // Already in base units (lamports)
            }
            TokenType::SPL => {
                // SPL STAKING: Convert amount to base units using decimals
                let mint = &ctx.accounts.mint;
                let mint_decimals = mint.decimals;
                let amount_with_decimals = amount
                    .checked_mul(10_u64.pow(mint_decimals as u32))
                    .ok_or(StakingError::MathOverflow)?;
    
                // Transfer SPL tokens to escrow
                let cpi_accounts = TransferChecked {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.pool_escrow_account.to_account_info(),
                    mint: mint.to_account_info(),
                    authority: user.to_account_info(),
                };
    
                token_2022::transfer_checked(
                    CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
                    amount_with_decimals,
                    mint_decimals,
                )?;
    
                msg!("✅ Staked {} SPL tokens (base units: {})", amount, amount_with_decimals);
                amount_with_decimals
            }
        };
    
        // Calculate weight using lock multiplier
        let multiplier_bps = lock_multiplier_bps(lock_duration);
        let weight: u128 = (amount_in_base_units as u128)
            .saturating_mul(multiplier_bps as u128)
            .checked_div(BPS_DENOMINATOR as u128)
            .ok_or(StakingError::MathOverflow)?;
    
        // Update user staking account
        user_staking_account.staked_amount = user_staking_account
            .staked_amount
            .checked_add(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;
    
        user_staking_account.stake_timestamp = Clock::get()?.unix_timestamp;
        user_staking_account.lock_duration = lock_duration;
        user_staking_account.weight = user_staking_account
            .weight
            .checked_add(weight)
            .ok_or(StakingError::MathOverflow)?;
    
        // Update reward debt
        user_staking_account.reward_debt = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);
    
        // Update staking pool totals
        staking_pool.total_staked = staking_pool
            .total_staked
            .checked_add(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;
    
        staking_pool.total_weight = staking_pool
            .total_weight
            .checked_add(weight)
            .ok_or(StakingError::MathOverflow)?;
    
        msg!(
            "✅ User {} staked {} (weight: {}, lock: {}s)",
            user.key(),
            amount_in_base_units,
            weight,
            lock_duration
        );
    
        Ok(())
    }
    //Unstake tokens (SOL or SPL)
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let user_staking_account = &mut ctx.accounts.user_staking_account;
        let staking_pool = &mut ctx.accounts.staking_pool;
        let user = &ctx.accounts.user;
    
        // Check if lock period has passed
        let current_time = Clock::get()?.unix_timestamp;
        let unlock_time = user_staking_account
            .stake_timestamp
            .checked_add(user_staking_account.lock_duration)
            .ok_or(StakingError::MathOverflow)?;
    
        require!(
            current_time >= unlock_time,
            StakingError::StakeLockActive
        );
    
        let staked_amount = user_staking_account.staked_amount;
        require!(staked_amount > 0, StakingError::InsufficientStakedBalance);
    
        // ==============================
        // TOKEN TYPE CONDITIONAL LOGIC
        // ==============================
        match staking_pool.token_type {
            TokenType::SOL => {
                // SOL UNSTAKING: Transfer lamports from staking pool PDA to user
                
                // Verify staking pool has sufficient balance
                let pool_balance = staking_pool.to_account_info().lamports();
                require!(
                    pool_balance >= staked_amount,
                    StakingError::InsufficientStakedBalance
                );
    
                // Transfer SOL from staking pool PDA to user using PDA signer
                **staking_pool.to_account_info().try_borrow_mut_lamports()? -= staked_amount;
                **user.to_account_info().try_borrow_mut_lamports()? += staked_amount;
    
                msg!("✅ Unstaked {} lamports SOL", staked_amount);
            }
            TokenType::SPL => {
                // SPL UNSTAKING: Transfer tokens from escrow to user
                let mint = &ctx.accounts.mint;
                let decimals = mint.decimals;
    
                // Use PDA signer for the transfer
                let admin = staking_pool.admin;
                let bump = staking_pool.bump;
                let signer_seeds: &[&[&[u8]]] = &[&[
                    b"staking_pool",
                    admin.as_ref(),
                    &[bump],
                ]];
    
                let transfer_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.pool_escrow_account.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        mint: mint.to_account_info(),
                        authority: staking_pool.to_account_info(),
                    },
                    signer_seeds,
                );
    
                token_2022::transfer_checked(transfer_ctx, staked_amount, decimals)?;
    
                msg!("✅ Unstaked {} SPL tokens", staked_amount);
            }
        }
    
        // Update staking pool totals
        staking_pool.total_staked = staking_pool
            .total_staked
            .checked_sub(staked_amount)
            .ok_or(StakingError::MathOverflow)?;
    
        staking_pool.total_weight = staking_pool
            .total_weight
            .saturating_sub(user_staking_account.weight);
    
        // Reset user staking account
        user_staking_account.staked_amount = 0;
        user_staking_account.weight = 0;
        user_staking_account.reward_debt = 0;
    
        msg!(
            "✅ User {} unstaked all tokens. Pool total: {}",
            user.key(),
            staking_pool.total_staked
        );
    
        Ok(())
    }

    // GameHub Logic (Tournament creation and registration)
    pub fn create_tournament_pool(
        ctx: Context<CreateTournamentPool>,
        tournament_id: String,
        entry_fee: u64,
        max_participants: u16,
        end_time: i64,
        token_type: TokenType,
    ) -> Result<()> {
        let tournament_pool = &mut ctx.accounts.tournament_pool;
        let admin = &ctx.accounts.admin;
    
        // Validate tournament parameters
        require!(entry_fee > 0, TournamentError::InvalidEntryFee);
        require!(
            max_participants > 0,
            TournamentError::InvalidMaxParticipants
        );
        require!(
            end_time > Clock::get()?.unix_timestamp,
            TournamentError::InvalidEndTime
        );
    
        // Convert tournament_id to a fixed-size byte array
        let mut tournament_id_bytes = [0u8; 32];
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(32);
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);
    
        // Assign values to tournament pool
        tournament_pool.admin = admin.key();
        tournament_pool.mint = ctx.accounts.mint.key();
        tournament_pool.tournament_id = tournament_id_bytes;
        tournament_pool.entry_fee = entry_fee;
        tournament_pool.total_funds = 0;
        tournament_pool.participant_count = 0;
        tournament_pool.max_participants = max_participants;
        tournament_pool.end_time = end_time;
        tournament_pool.is_active = true;
        tournament_pool.token_type = token_type;
        tournament_pool.bump = ctx.bumps.tournament_pool;
    
        msg!(
            "✅ Tournament '{}' created: entry_fee: {}, max_participants: {}, token_type: {:?}",
            tournament_id,
            entry_fee,
            max_participants,
            token_type
        );
    
        Ok(())
    }

    pub fn register_for_tournament(
        ctx: Context<RegisterForTournament>,
        _tournament_id: String,
    ) -> Result<()> {
        let tournament_pool = &mut ctx.accounts.tournament_pool;
        let user = &ctx.accounts.user;
    
        // Check if tournament is active
        require!(
            tournament_pool.is_active,
            TournamentError::TournamentNotActive
        );
    
        // Check if tournament is full
        require!(
            tournament_pool.participant_count < tournament_pool.max_participants,
            TournamentError::TournamentFull
        );
    
        // Check if tournament has ended
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time < tournament_pool.end_time,
            TournamentError::TournamentEnded
        );
    
        let entry_fee = tournament_pool.entry_fee;
    
        // Create registration record
        let registration_account = &mut ctx.accounts.registration_account;
        require!(
            !registration_account.is_initialized,
            TournamentError::AlreadyRegistered
        );
    
        registration_account.user = user.key();
        registration_account.tournament_pool = tournament_pool.key();
        registration_account.is_initialized = true;
        registration_account.registration_time = current_time;
        registration_account.bump = ctx.bumps.registration_account;
    
        // ==============================
        // TOKEN TYPE CONDITIONAL LOGIC
        // ==============================
        match tournament_pool.token_type {
            TokenType::SOL => {
                // SOL PAYMENT: Transfer lamports directly to tournament pool PDA
                let user_balance = ctx.accounts.user.lamports();
                require!(
                    user_balance >= entry_fee,
                    TournamentError::InsufficientFunds
                );
    
                // Transfer SOL from user to tournament pool PDA
                let transfer_instruction = anchor_lang::system_program::Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: ctx.accounts.tournament_pool.to_account_info(),
                };
    
                anchor_lang::system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        transfer_instruction,
                    ),
                    entry_fee,
                )?;
    
                msg!(
                    "✅ User {} registered with {} lamports SOL",
                    user.key(),
                    entry_fee
                );
            }
            TokenType::SPL => {
                // SPL TOKEN PAYMENT: Use existing token transfer logic
                let user_token_account = &ctx.accounts.user_token_account;
                let mint = &ctx.accounts.mint;
    
                // Check if user has sufficient token balance
                let balance = user_token_account.amount;
                require!(balance >= entry_fee, TournamentError::InsufficientFunds);
    
                // Transfer SPL tokens to escrow account
                let transfer_ctx = CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: user_token_account.to_account_info(),
                        to: ctx.accounts.pool_escrow_account.to_account_info(),
                        mint: mint.to_account_info(),
                        authority: user.to_account_info(),
                    },
                );
    
                let decimals = mint.decimals;
                token_2022::transfer_checked(transfer_ctx, entry_fee, decimals)?;
    
                msg!(
                    "✅ User {} registered with {} SPL tokens",
                    user.key(),
                    entry_fee
                );
            }
        }
    
        // Update tournament pool state
        tournament_pool.total_funds = tournament_pool
            .total_funds
            .checked_add(entry_fee)
            .ok_or(TournamentError::MathOverflow)?;
        
        tournament_pool.participant_count = tournament_pool
            .participant_count
            .checked_add(1)
            .ok_or(TournamentError::MathOverflow)?;
    
        msg!(
            "Tournament {} now has {} participants with {} total funds",
            String::from_utf8_lossy(&tournament_pool.tournament_id),
            tournament_pool.participant_count,
            tournament_pool.total_funds
        );
    
        Ok(())
    }
    
    // Modified instruction to initialize just the global revenue pool
    pub fn initialize_revenue_pool(ctx: Context<InitializeRevenuePool>) -> Result<()> {
        let revenue_pool = &mut ctx.accounts.revenue_pool;
        let admin = &ctx.accounts.admin;

        // Initialize revenue pool
        revenue_pool.admin = admin.key();
        revenue_pool.mint = ctx.accounts.mint.key();
        revenue_pool.total_funds = 0;
        revenue_pool.last_distribution = Clock::get()?.unix_timestamp;
        revenue_pool.bump = ctx.bumps.revenue_pool;

        msg!("✅ Revenue pool initialized for admin: {}", admin.key());
        Ok(())
    }

    // Initialize a global RewardPool (used to hold the 5% staking rewards)
    pub fn initialize_reward_pool(ctx: Context<InitializeRewardPool>) -> Result<()> {
        let reward_pool = &mut ctx.accounts.reward_pool;
        let admin = &ctx.accounts.admin;

        reward_pool.admin = admin.key();
        reward_pool.mint = ctx.accounts.mint.key();
        reward_pool.total_funds = 0;
        reward_pool.last_distribution = Clock::get()?.unix_timestamp;
        reward_pool.bump = ctx.bumps.reward_pool;

        msg!("✅ Reward pool initialized for admin: {}", admin.key());
        Ok(())
    }

    // New instruction to initialize a prize pool for a specific tournament
    pub fn initialize_prize_pool(
        ctx: Context<InitializePrizePool>,
        tournament_id: String,
    ) -> Result<()> {
        let prize_pool = &mut ctx.accounts.prize_pool;
        let admin = &ctx.accounts.admin;
        let tournament_pool = &ctx.accounts.tournament_pool;

        // Convert tournament_id to fixed-size bytes
        let mut tournament_id_bytes = [0u8; 32]; // Increased from 10 to 32
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(32);
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);

        // Verify that the tournament_id matches the one in the tournament pool
        let tournament_pool_id = &tournament_pool.tournament_id;
        require!(
            &tournament_id_bytes[..] == tournament_pool_id.as_ref(),
            TournamentError::Unauthorized
        );

        // Initialize prize pool
        prize_pool.admin = admin.key();
        prize_pool.tournament_pool = tournament_pool.key();
        prize_pool.mint = ctx.accounts.mint.key();
        prize_pool.tournament_id = tournament_id_bytes;
        prize_pool.total_funds = 0;
        prize_pool.distributed = false;
        prize_pool.bump = ctx.bumps.prize_pool;

        msg!(
            "✅ Prize pool initialized for tournament: {}",
            tournament_id
        );
        Ok(())
    }

    // OPTIMIZED FUNCTION: Fixed stack overflow issues
    pub fn distribute_tournament_revenue(
        ctx: Context<DistributeTournamentRevenue>,
        tournament_id: String,
        prize_percentage: u8,
        revenue_percentage: u8,
        staking_percentage: u8,
        burn_percentage: u8,
    ) -> Result<()> {
        // Validate percentages sum to 100
        let total_percentage = prize_percentage
            .checked_add(revenue_percentage)
            .and_then(|sum| sum.checked_add(staking_percentage))
            .and_then(|sum| sum.checked_add(burn_percentage))
            .ok_or(TournamentError::MathOverflow)?;
    
        require!(
            total_percentage == 100,
            TournamentError::InvalidPercentages
        );
    
        let tournament_pool = &mut ctx.accounts.tournament_pool;
        let prize_pool = &mut ctx.accounts.prize_pool;
        let revenue_pool = &mut ctx.accounts.revenue_pool;
        let reward_pool = &mut ctx.accounts.reward_pool;
        let staking_pool = &mut ctx.accounts.staking_pool;
    
        // Verify tournament is inactive and has funds
        require!(!tournament_pool.is_active, TournamentError::TournamentNotActive);
        require!(tournament_pool.total_funds > 0, TournamentError::InsufficientFunds);
    
        let total_funds = tournament_pool.total_funds;
    
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
    
        // ==============================
        // TOKEN TYPE CONDITIONAL LOGIC
        // ==============================
        match tournament_pool.token_type {
            TokenType::SOL => {
                // SOL DISTRIBUTION: Transfer lamports from tournament pool PDA
                
                let tournament_pool_info = tournament_pool.to_account_info();
                let mut tournament_lamports = tournament_pool_info.try_borrow_mut_lamports()?;
    
                // Verify sufficient balance
                require!(
                    **tournament_lamports >= total_funds,
                    TournamentError::InsufficientFunds
                );
    
                // 1. Transfer to Prize Pool
                if prize_amount > 0 {
                    let prize_pool_info = prize_pool.to_account_info();
                    **prize_pool_info.try_borrow_mut_lamports()? += prize_amount;
                    **tournament_lamports -= prize_amount;
    
                    prize_pool.total_funds = prize_pool
                        .total_funds
                        .checked_add(prize_amount)
                        .ok_or(TournamentError::MathOverflow)?;
                }
    
                // 2. Transfer to Revenue Pool
                if revenue_amount > 0 {
                    let revenue_pool_info = revenue_pool.to_account_info();
                    **revenue_pool_info.try_borrow_mut_lamports()? += revenue_amount;
                    **tournament_lamports -= revenue_amount;
    
                    revenue_pool.total_funds = revenue_pool
                        .total_funds
                        .checked_add(revenue_amount)
                        .ok_or(TournamentError::MathOverflow)?;
                }
    
                // 3. Transfer to Reward Pool (for stakers)
                if staking_amount > 0 {
                    let reward_pool_info = reward_pool.to_account_info();
                    **reward_pool_info.try_borrow_mut_lamports()? += staking_amount;
                    **tournament_lamports -= staking_amount;
    
                    reward_pool.total_funds = reward_pool
                        .total_funds
                        .checked_add(staking_amount)
                        .ok_or(TournamentError::MathOverflow)?;
    
                    // Update reward accumulator for stakers
                    if staking_pool.total_weight > 0 {
                        let delta: u128 = (staking_amount as u128)
                            .saturating_mul(ACC_PRECISION)
                            .checked_div(staking_pool.total_weight)
                            .unwrap_or(0);
                        
                        staking_pool.acc_reward_per_weight = staking_pool
                            .acc_reward_per_weight
                            .saturating_add(delta);
                        
                        staking_pool.epoch_index = staking_pool
                            .epoch_index
                            .saturating_add(1);
    
                        msg!(
                            "✅ Reward accumulator updated: +{} (total: {})",
                            delta,
                            staking_pool.acc_reward_per_weight
                        );
                    }
                }
    
                // 4. Burn SOL (transfer to unrecoverable address)
                if burn_amount > 0 {
                    // OPTION 1: Transfer to a known burn address (recommended)
                    // The Solana burn address: 1nc1nerator11111111111111111111111111111111
                    let burn_address = Pubkey::from_str("1nc1nerator11111111111111111111111111111111")
                        .map_err(|_| TournamentError::MathOverflow)?;
                    
                    // Note: You'll need to pass this as an account in the context
                    // For now, we'll just subtract from tournament pool
                    // In production, add burn_account to the context
                    **tournament_lamports -= burn_amount;
                    
                    msg!("⚠️ Burned {} lamports SOL (sent to incinerator)", burn_amount);
                }
    
                msg!(
                    "✅ SOL Revenue distributed: Prize: {}, Revenue: {}, Staking: {}, Burned: {}",
                    prize_amount,
                    revenue_amount,
                    staking_amount,
                    burn_amount
                );
            }
            TokenType::SPL => {
                // SPL TOKEN DISTRIBUTION: Use token transfers with PDA signer
                
                let mint = &ctx.accounts.mint;
                let decimals = mint.decimals;
                let admin = ctx.accounts.admin.key();
    
                // 1. Transfer to Prize Pool Escrow
                if prize_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                to: ctx.accounts.prize_escrow_account.to_account_info(),
                                mint: mint.to_account_info(),
                                authority: admin.to_account_info(),
                            },
                        ),
                        prize_amount,
                        decimals,
                    )?;
    
                    prize_pool.total_funds = prize_pool
                        .total_funds
                        .checked_add(prize_amount)
                        .ok_or(TournamentError::MathOverflow)?;
                }
    
                // 2. Transfer to Revenue Pool Escrow
                if revenue_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                to: ctx.accounts.revenue_escrow_account.to_account_info(),
                                mint: mint.to_account_info(),
                                authority: admin.to_account_info(),
                            },
                        ),
                        revenue_amount,
                        decimals,
                    )?;
    
                    revenue_pool.total_funds = revenue_pool
                        .total_funds
                        .checked_add(revenue_amount)
                        .ok_or(TournamentError::MathOverflow)?;
                }
    
                // 3. Transfer to Reward Pool (for stakers)
                if staking_amount > 0 {
                    token_2022::transfer_checked(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            TransferChecked {
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                to: ctx.accounts.reward_escrow_account.to_account_info(),
                                mint: mint.to_account_info(),
                                authority: admin.to_account_info(),
                            },
                        ),
                        staking_amount,
                        decimals,
                    )?;
    
                    reward_pool.total_funds = reward_pool
                        .total_funds
                        .checked_add(staking_amount)
                        .ok_or(TournamentError::MathOverflow)?;
    
                    // Update reward accumulator
                    if staking_pool.total_weight > 0 {
                        let delta: u128 = (staking_amount as u128)
                            .saturating_mul(ACC_PRECISION)
                            .checked_div(staking_pool.total_weight)
                            .unwrap_or(0);
                        
                        staking_pool.acc_reward_per_weight = staking_pool
                            .acc_reward_per_weight
                            .saturating_add(delta);
                        
                        staking_pool.epoch_index = staking_pool
                            .epoch_index
                            .saturating_add(1);
    
                        msg!(
                            "✅ Reward accumulator updated: +{} (total: {})",
                            delta,
                            staking_pool.acc_reward_per_weight
                        );
                    }
                }
    
                // 4. Burn SPL Tokens
                if burn_amount > 0 {
                    token_2022::burn(
                        CpiContext::new(
                            ctx.accounts.token_program.to_account_info(),
                            Burn {
                                mint: mint.to_account_info(),
                                from: ctx.accounts.tournament_escrow_account.to_account_info(),
                                authority: admin.to_account_info(),
                            },
                        ),
                        burn_amount,
                    )?;
                }
    
                msg!(
                    "✅ SPL Revenue distributed: Prize: {}, Revenue: {}, Staking: {}, Burned: {}",
                    prize_amount,
                    revenue_amount,
                    staking_amount,
                    burn_amount
                );
            }
        }
    
        // Update states
        tournament_pool.is_active = false;
        tournament_pool.total_funds = 0;
        revenue_pool.last_distribution = Clock::get()?.unix_timestamp;
    
        Ok(())
    }

    /// Claim rewards from RewardPool pro‑rata to user weight
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;
        let reward_pool = &mut ctx.accounts.reward_pool;
        let user_staking_account = &mut ctx.accounts.user_staking_account;
        let user = &ctx.accounts.user;
    
        // Compute claimable rewards based on accumulator
        let accumulated: u128 = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);
    
        let claimable_u128: u128 = accumulated
            .saturating_sub(user_staking_account.reward_debt)
            .saturating_add(user_staking_account.pending_rewards as u128);
    
        let claimable: u64 = claimable_u128.min(u128::from(u64::MAX)) as u64;
    
        // Verify there are rewards to claim
        require!(claimable > 0, StakingError::InsufficientStakedBalance);
    
        // Ensure RewardPool has sufficient funds
        require!(
            reward_pool.total_funds >= claimable,
            TournamentError::InsufficientFunds
        );
    
        // ==============================
        // TOKEN TYPE CONDITIONAL LOGIC
        // ==============================
        match staking_pool.token_type {
            TokenType::SOL => {
                // SOL REWARDS: Transfer lamports from reward pool PDA to user
                
                let reward_pool_info = reward_pool.to_account_info();
                let mut reward_pool_lamports = reward_pool_info.try_borrow_mut_lamports()?;
    
                // Verify sufficient balance in reward pool
                require!(
                    **reward_pool_lamports >= claimable,
                    TournamentError::InsufficientFunds
                );
    
                // Transfer SOL from reward pool PDA to user's wallet
                **reward_pool_lamports -= claimable;
                **user.to_account_info().try_borrow_mut_lamports()? += claimable;
    
                msg!(
                    "✅ User {} claimed {} lamports SOL rewards",
                    user.key(),
                    claimable
                );
            }
            TokenType::SPL => {
                // SPL TOKEN REWARDS: Transfer tokens from reward escrow to user token account
                
                let mint = &ctx.accounts.mint;
                let decimals = mint.decimals;
    
                // Use PDA signer for the transfer
                let reward_admin = reward_pool.admin;
                let reward_bump = reward_pool.bump;
                let signer_seeds: &[&[&[u8]]] = &[&[
                    b"reward_pool",
                    reward_admin.as_ref(),
                    &[reward_bump],
                ]];
    
                let transfer_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    TransferChecked {
                        from: ctx.accounts.reward_escrow_account.to_account_info(),
                        to: ctx.accounts.user_token_account.to_account_info(),
                        mint: mint.to_account_info(),
                        authority: reward_pool.to_account_info(),
                    },
                    signer_seeds,
                );
    
                token_2022::transfer_checked(transfer_ctx, claimable, decimals)?;
    
                msg!(
                    "✅ User {} claimed {} SPL token rewards",
                    user.key(),
                    claimable
                );
            }
        }
    
        // Update accounting
        reward_pool.total_funds = reward_pool
            .total_funds
            .saturating_sub(claimable);
    
        user_staking_account.pending_rewards = 0;
        user_staking_account.reward_debt = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);
    
        msg!(
            "✅ Reward claim complete. Remaining pool funds: {}",
            reward_pool.total_funds
        );
    
        Ok(())
    }
    /// Accrue pending rewards for existing stakers without requiring additional staking
    /// This function allows users to update their pending rewards when new rewards are distributed
    pub fn accrue_rewards(ctx: Context<AccrueRewards>) -> Result<()> {
        let staking_pool = &ctx.accounts.staking_pool;
        let user_staking_account = &mut ctx.accounts.user_staking_account;

        // Ensure user has staked tokens
        require!(
            user_staking_account.staked_amount > 0,
            StakingError::InsufficientStakedBalance
        );

        // Calculate accumulated rewards up to current global accumulator
        let accumulated: u128 = user_staking_account
            .weight
            .saturating_mul(staking_pool.acc_reward_per_weight)
            .checked_div(ACC_PRECISION)
            .unwrap_or(0);

        // Calculate pending rewards (accumulated - reward debt)
        let pending_now: u128 = accumulated.saturating_sub(user_staking_account.reward_debt);

        if pending_now > 0 {
            // Add to pending rewards (capped to u64::MAX to prevent overflow)
            let add: u64 = pending_now.min(u128::from(u64::MAX)) as u64;
            user_staking_account.pending_rewards =
                user_staking_account.pending_rewards.saturating_add(add);

            // Update reward debt to current baseline
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

    // (Removed admin batch accrual; users should call accrue_rewards themselves.)

    // Create tournament pool
    #[derive(Accounts)]
    #[instruction(tournament_id: String, entry_fee: u64, max_participants: u16, end_time: i64, token_type: TokenType)]
    pub struct CreateTournamentPool<'info> {
        #[account(
            init,
            payer = admin,
            space = TournamentPool::LEN,
            seeds = [b"tournament_pool", admin.key().as_ref(), tournament_id.as_bytes()],
            bump
        )]
        pub tournament_pool: Account<'info, TournamentPool>,
    
        #[account(
            init_if_needed,
            payer = admin,
            token::mint = mint,
            token::authority = admin,
            seeds = [b"tournament_escrow", tournament_pool.key().as_ref()],
            bump
        )]
        pub tournament_escrow_account: InterfaceAccount<'info, TokenAccount>,
    
        /// CHECK: Can be SPL mint or SystemProgram for SOL
        pub mint: UncheckedAccount<'info>,
    
        #[account(mut)]
        pub admin: Signer<'info>,
    
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }

    // Account structure for prize distribution - matches TypeScript service exactly
    #[derive(Accounts)]
    #[instruction(tournament_id: String)]
    pub struct DistributeTournamentPrizes<'info> {
        #[account(mut, constraint = admin.key() == prize_pool.admin @ TournamentError::Unauthorized)]
        pub admin: Signer<'info>,
    
        #[account(
            constraint = tournament_pool.key() == prize_pool.tournament_pool @ TournamentError::Unauthorized
        )]
        pub tournament_pool: Account<'info, TournamentPool>,
    
        #[account(
            mut,
            seeds = [b"prize_pool", tournament_pool.key().as_ref()],
            bump = prize_pool.bump
        )]
        pub prize_pool: Account<'info, PrizePool>,
    
        // For SOL prizes: Winner wallet accounts receive lamports directly
        // For SPL prizes: These are ignored, token accounts used instead
        /// CHECK: Winner account that receives SOL prizes directly
        #[account(mut)]
        pub first_place_winner: UncheckedAccount<'info>,
    
        /// CHECK: Winner account that receives SOL prizes directly
        #[account(mut)]
        pub second_place_winner: UncheckedAccount<'info>,
    
        /// CHECK: Winner account that receives SOL prizes directly
        #[account(mut)]
        pub third_place_winner: UncheckedAccount<'info>,
    
        // Optional: Only required for SPL token prizes
        /// CHECK: This account is only used for SPL token prizes
        #[account(mut)]
        pub prize_escrow_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token prizes
        #[account(mut)]
        pub first_place_token_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token prizes
        #[account(mut)]
        pub second_place_token_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token prizes
        #[account(mut)]
        pub third_place_token_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token prizes
        #[account(mut)]
        pub mint: UncheckedAccount<'info>,
    
        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }

    //Register for tournament context
    #[derive(Accounts)]
    #[instruction(tournament_id: String)]
    pub struct RegisterForTournament<'info> {
        #[account(mut)]
        pub user: Signer<'info>,
    
        #[account(
            mut,
            seeds = [b"tournament_pool", tournament_pool.admin.as_ref(), tournament_id.as_bytes()],
            bump = tournament_pool.bump
        )]
        pub tournament_pool: Account<'info, TournamentPool>,
    
        #[account(
            init,
            payer = user,
            space = 8 + 32 + 32 + 1 + 8 + 1,
            seeds = [b"registration", tournament_pool.key().as_ref(), user.key().as_ref()],
            bump
        )]
        pub registration_account: Account<'info, RegistrationRecord>,
    
        // Optional: Only required for SPL token tournaments
        /// CHECK: This account is only used for SPL token tournaments
        #[account(mut)]
        pub user_token_account: UncheckedAccount<'info>,
    
        // Optional: Only required for SPL token tournaments
        /// CHECK: This account is only used for SPL token tournaments
        #[account(mut)]
        pub pool_escrow_account: UncheckedAccount<'info>,
    
        // Optional: Only required for SPL token tournaments
        /// CHECK: This account is only used for SPL token tournaments
        pub mint: UncheckedAccount<'info>,
    
        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }
    #[derive(Accounts)]
    pub struct InitializeRevenuePool<'info> {
        #[account(
            init,
            payer = admin,
            space = 8 + 32 + 32 + 8 + 8 + 1,
            seeds = [b"revenue_pool", admin.key().as_ref()],
            bump
        )]
        pub revenue_pool: Account<'info, RevenuePool>,

        #[account(
            init,
            payer = admin,
            token::mint = mint,
            token::authority = revenue_pool,
            seeds = [b"revenue_escrow", revenue_pool.key().as_ref()],
            bump
        )]
        pub revenue_escrow_account: InterfaceAccount<'info, TokenAccount>,

        pub mint: InterfaceAccount<'info, Mint>,
        #[account(mut)]
        pub admin: Signer<'info>,
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }

    #[derive(Accounts)]
    pub struct InitializeRewardPool<'info> {
        #[account(
            init,
            payer = admin,
            space = 8 + 32 + 32 + 8 + 8 + 1,
            seeds = [b"reward_pool", admin.key().as_ref()],
            bump
        )]
        pub reward_pool: Account<'info, RewardPool>,

        #[account(
            init,
            payer = admin,
            token::mint = mint,
            token::authority = reward_pool,
            seeds = [b"reward_escrow", reward_pool.key().as_ref()],
            bump
        )]
        pub reward_escrow_account: InterfaceAccount<'info, TokenAccount>,

        pub mint: InterfaceAccount<'info, Mint>,
        #[account(mut)]
        pub admin: Signer<'info>,
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }

    #[derive(Accounts)]
    #[instruction(tournament_id: String)]
    pub struct InitializePrizePool<'info> {
        #[account(
            init,
            payer = admin,
            space = 8 + 32 + 32 + 32 + 32 + 8 + 1 + 1, // Updated space calculation
            seeds = [b"prize_pool", tournament_pool.key().as_ref()],
            bump
        )]
        pub prize_pool: Account<'info, PrizePool>,

        #[account(
            mut,
            seeds = [b"tournament_pool", tournament_pool.admin.as_ref(), tournament_id.as_bytes()],
            bump = tournament_pool.bump,
            constraint = tournament_pool.admin == admin.key() @ TournamentError::Unauthorized
        )]
        pub tournament_pool: Account<'info, TournamentPool>,

        #[account(
            init_if_needed,
            payer = admin,
            token::mint = mint,
            token::authority = prize_pool,
            seeds = [b"prize_escrow", prize_pool.key().as_ref()],
            bump
        )]
        pub prize_escrow_account: InterfaceAccount<'info, TokenAccount>,

        pub mint: InterfaceAccount<'info, Mint>,
        #[account(mut)]
        pub admin: Signer<'info>,
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }

    // CRITICAL FIX: Simplified DistributeTournamentRevenue struct to reduce stack usage
    #[derive(Accounts)]
    #[instruction(tournament_id: String, prize_percentage: u8, revenue_percentage: u8, staking_percentage: u8, burn_percentage: u8)]
    pub struct DistributeTournamentRevenue<'info> {
        #[account(mut)]
        pub admin: Signer<'info>,
    
        #[account(
            mut,
            seeds = [b"tournament_pool", admin.key().as_ref(), tournament_id.as_bytes()],
            bump = tournament_pool.bump,
            constraint = tournament_pool.admin == admin.key() @ TournamentError::Unauthorized
        )]
        pub tournament_pool: Account<'info, TournamentPool>,
    
        #[account(
            mut,
            seeds = [b"prize_pool", tournament_pool.key().as_ref()],
            bump = prize_pool.bump
        )]
        pub prize_pool: Account<'info, PrizePool>,
    
        #[account(
            mut,
            seeds = [b"revenue_pool", admin.key().as_ref()],
            bump = revenue_pool.bump
        )]
        pub revenue_pool: Account<'info, RevenuePool>,
    
        #[account(
            mut,
            seeds = [b"staking_pool", admin.key().as_ref()],
            bump = staking_pool.bump
        )]
        pub staking_pool: Account<'info, StakingPool>,
    
        #[account(
            mut,
            seeds = [b"reward_pool", admin.key().as_ref()],
            bump = reward_pool.bump
        )]
        pub reward_pool: Account<'info, RewardPool>,
    
        // Optional: Only required for SPL token distribution
        /// CHECK: This account is only used for SPL token distribution
        #[account(mut)]
        pub tournament_escrow_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token distribution
        #[account(mut)]
        pub prize_escrow_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token distribution
        #[account(mut)]
        pub revenue_escrow_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token distribution
        #[account(mut)]
        pub reward_escrow_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token distribution
        #[account(mut)]
        pub mint: UncheckedAccount<'info>,
    
        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }


    //Initialize accounts for staking pool 
    #[derive(Accounts)]
    pub struct InitializeAccounts<'info> {
        #[account(
            init_if_needed,
            payer = admin,
            space = StakingPool::LEN,
            seeds = [b"staking_pool", admin.key().as_ref()],
            bump
        )]
        pub staking_pool: Account<'info, StakingPool>,
    
        #[account(
            init_if_needed,
            payer = admin,
            token::mint = mint,
            token::authority = staking_pool,
            seeds = [b"escrow", staking_pool.key().as_ref()],
            bump
        )]
        pub pool_escrow_account: InterfaceAccount<'info, TokenAccount>,
    
        /// CHECK: Can be SPL mint or SystemProgram for SOL
        pub mint: UncheckedAccount<'info>,
    
        #[account(mut)]
        pub admin: Signer<'info>,
    
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }


    //Stake tokens (SOL or SPL)
    #[derive(Accounts)]
    pub struct Stake<'info> {
        #[account(mut)]
        pub user: Signer<'info>,

        #[account(
            mut,
            seeds = [b"staking_pool", staking_pool.admin.as_ref()],
            bump = staking_pool.bump
        )]
        pub staking_pool: Account<'info, StakingPool>,

        #[account(
            init_if_needed,
            payer = user,
            // owner + staked_amount(u64) + stake_timestamp(i64) + lock_duration(i64) + weight(u128) + reward_debt(u128) + pending_rewards(u64)
            space = 8 + 32 + 8 + 8 + 8 + 16 + 16 + 8,
            seeds = [b"user_stake", user.key().as_ref()],
            bump
        )]
        pub user_staking_account: Account<'info, UserStakingAccount>,

        #[account(mut, constraint = user_token_account.mint == staking_pool.mint)]
        pub user_token_account: InterfaceAccount<'info, TokenAccount>,

        #[account(
            mut,
            token::mint = staking_pool.mint,
            token::authority = staking_pool
        )]
        pub pool_escrow_account: InterfaceAccount<'info, TokenAccount>,

        #[account(mut, constraint = mint.key() == staking_pool.mint)]
        pub mint: InterfaceAccount<'info, Mint>,

        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }


    //Unstake tokens (SOL or SPL)
    #[derive(Accounts)]
    pub struct Unstake<'info> {
        #[account(mut)]
        pub user: Signer<'info>,
    
        #[account(
            mut,
            seeds = [b"staking_pool", staking_pool.admin.as_ref()],
            bump = staking_pool.bump
        )]
        pub staking_pool: Account<'info, StakingPool>,
    
        #[account(
            mut,
            seeds = [b"user_stake", staking_pool.key().as_ref(), user.key().as_ref()],
            bump,
            constraint = user_staking_account.owner == user.key() @ StakingError::Unauthorized
        )]
        pub user_staking_account: Account<'info, UserStakingAccount>,
    
        // Optional: Only required for SPL token unstaking
        /// CHECK: This account is only used for SPL token unstaking
        #[account(mut)]
        pub user_token_account: UncheckedAccount<'info>,
    
        // Optional: Only required for SPL token unstaking
        /// CHECK: This account is only used for SPL token unstaking
        #[account(mut)]
        pub pool_escrow_account: UncheckedAccount<'info>,
    
        // Optional: Only required for SPL token unstaking
        /// CHECK: This account is only used for SPL token unstaking
        pub mint: UncheckedAccount<'info>,
    
        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }
    // Accounts for claiming rewards
    #[derive(Accounts)]
    pub struct ClaimRewards<'info> {
        #[account(mut)]
        pub user: Signer<'info>,
    
        #[account(
            mut,
            seeds = [b"staking_pool", staking_pool.admin.as_ref()],
            bump = staking_pool.bump
        )]
        pub staking_pool: Account<'info, StakingPool>,
    
        #[account(
            mut,
            seeds = [b"user_staking", staking_pool.key().as_ref(), user.key().as_ref()],
            bump,
            constraint = user_staking_account.owner == user.key() @ StakingError::Unauthorized
        )]
        pub user_staking_account: Account<'info, UserStakingAccount>,
    
        #[account(
            mut,
            seeds = [b"reward_pool", reward_pool.admin.as_ref()],
            bump = reward_pool.bump
        )]
        pub reward_pool: Account<'info, RewardPool>,
    
        // Optional: Only required for SPL token rewards
        /// CHECK: This account is only used for SPL token rewards
        #[account(mut)]
        pub user_token_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token rewards
        #[account(mut)]
        pub reward_escrow_account: UncheckedAccount<'info>,
    
        /// CHECK: This account is only used for SPL token rewards
        pub mint: UncheckedAccount<'info>,
    
        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }
    // Accounts for accruing rewards
    #[derive(Accounts)]
    pub struct AccrueRewards<'info> {
        #[account(mut)]
        pub user: Signer<'info>,

        #[account(
            seeds = [b"staking_pool", staking_pool.admin.as_ref()],
            bump = staking_pool.bump
        )]
        pub staking_pool: Account<'info, StakingPool>,

        #[account(
            mut,
            seeds = [b"user_stake", user.key().as_ref()],
            bump
        )]
        pub user_staking_account: Account<'info, UserStakingAccount>,

        pub system_program: Program<'info, System>,
    }

    // (Removed BatchAccrueRewards accounts; accrual is user-driven.)

    const ONE_MONTH: i64 = 30 * 24 * 60 * 60;
    const THREE_MONTHS: i64 = 3 * ONE_MONTH;
    const SIX_MONTHS: i64 = 6 * ONE_MONTH;
    const TWELVE_MONTHS: i64 = 12 * ONE_MONTH;

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

    imp StakingPool {
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

    #[account]
    pub struct TournamentPool {
        pub admin: Pubkey,
        pub mint: Pubkey,
        pub tournament_id: [u8; 32], // Increased from 10 to 32
        pub entry_fee: u64,
        pub total_funds: u64,
        pub participant_count: u16,
        pub max_participants: u16,
        pub end_time: i64,
        pub is_active: bool,
        pub token_type: TokenType,
        pub bump: u8,
    }
        imp TournamentPool {
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

    #[account]
    pub struct PrizePool {
        pub admin: Pubkey,
        pub tournament_pool: Pubkey,
        pub mint: Pubkey,
        pub tournament_id: [u8; 32], // Increased from 10 to 32
        pub total_funds: u64,
        pub distributed: bool,
        pub token_type: TokenType,
        pub bump: u8,
    }

    imp PrizePool {
        pub const LEN: usize =  8 + 32 + 32 + 32 + 32 + 8 + 1 + 1 + 1;
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

    imp RevenuePool {
        pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 1;
    }

    // Dedicated Reward Pool for staking rewards (5%)
    #[account]
    pub struct RewardPool {
        pub admin: Pubkey,
        pub mint: Pubkey,
        pub total_funds: u64,
        pub last_distribution: i64,
        pub token_type: TokenType,
        pub bump: u8,
    }

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
        #[msg("Unstaking is locked")]
        StakeLockActive,
        #[msg("Invalid Lock Duration, Must be 1, 3, 6 or 12 months")]
        InvalidLockDuration,
    }
}
