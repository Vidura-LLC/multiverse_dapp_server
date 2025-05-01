use anchor_lang::prelude::InterfaceAccount;
use anchor_lang::prelude::*;
use anchor_spl::token_2022::{self, Burn, Token2022, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

declare_id!("BmBAppuJQGGHmVizxKLBpJbFtq8yGe9v7NeVgHPEM4Vs");

#[program]
pub mod staking_and_gamehub {
    use super::*;

    /// Initializes all necessary accounts before staking
    pub fn initialize_accounts(ctx: Context<InitializeAccounts>) -> Result<()> {
        let staking_pool = &mut ctx.accounts.staking_pool;

        if staking_pool.total_staked > 0 {
            return Err(StakingError::AlreadyInitialized.into());
        }

        staking_pool.admin = ctx.accounts.admin.key();
        staking_pool.mint = ctx.accounts.mint.key();
        staking_pool.total_staked = 0;
        staking_pool.bump = ctx.bumps.staking_pool;

        msg!(
            "✅ Staking pool initialized with admin: {}",
            staking_pool.admin
        );
        Ok(())
    }

    /// Allows a user to stake tokens
    pub fn stake(ctx: Context<Stake>, amount: u64, lock_duration: i64) -> Result<()> {
        let mint_decimals = ctx.accounts.mint.decimals;
        let amount_in_base_units = amount
            .checked_mul(10_u64.pow(mint_decimals as u32))
            .ok_or(StakingError::MathOverflow)?;

        require!(
            lock_duration == ONE_MONTH
                || lock_duration == THREE_MONTHS
                || lock_duration == SIX_MONTHS
                || lock_duration == TWELVE_MONTHS,
            StakingError::InvalidLockDuration
        );

        // Transfer tokens to escrow
        let cpi_accounts = TransferChecked {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.pool_escrow_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        token_2022::transfer_checked(
            CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts),
            amount_in_base_units,
            mint_decimals,
        )?;

        // Update user staking account
        let user_staking_account = &mut ctx.accounts.user_staking_account;
        let _current_timestamp = Clock::get()?.unix_timestamp;
        user_staking_account.owner = ctx.accounts.user.key();
        user_staking_account.staked_amount = user_staking_account
            .staked_amount
            .checked_add(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;

        user_staking_account.stake_timestamp = _current_timestamp; // ✅ Store when staking happened
        user_staking_account.lock_duration = lock_duration; // ✅ Store lock duration separately

        // Update total staked in pool
        ctx.accounts.staking_pool.total_staked = ctx
            .accounts
            .staking_pool
            .total_staked
            .checked_add(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;

        msg!(
            "✅ {} tokens staked by user: {} for {} seconds",
            amount,
            ctx.accounts.user.key(),
            lock_duration
        );

        Ok(())
    }

    /// Allows users to unstake all of their tokens at any time
    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let user_staking_account = &mut ctx.accounts.user_staking_account;

        // Ensure the user has a staked balance
        require!(
            user_staking_account.staked_amount > 0,
            StakingError::InsufficientStakedBalance
        );

        let mint_decimals = ctx.accounts.mint.decimals;
        let amount_in_base_units = user_staking_account.staked_amount;

        // Transfer all staked tokens from the escrow account to the user's token account
        let staking_pool_seeds = &[
            b"staking_pool",
            ctx.accounts.staking_pool.admin.as_ref(),
            &[ctx.accounts.staking_pool.bump],
        ];
        let signer_seeds: &[&[&[u8]]] = &[staking_pool_seeds];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.pool_escrow_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.staking_pool.to_account_info(),
            },
            signer_seeds,
        );

        // Execute the transfer of tokens (entire staked amount)
        token_2022::transfer_checked(transfer_ctx, amount_in_base_units, mint_decimals)?;

        // Update the staking data
        user_staking_account.staked_amount = user_staking_account
            .staked_amount
            .checked_sub(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;

        ctx.accounts.staking_pool.total_staked = ctx
            .accounts
            .staking_pool
            .total_staked
            .checked_sub(amount_in_base_units)
            .ok_or(StakingError::MathOverflow)?;

        msg!(
            "✅ User {} unstaked all tokens. Remaining: {}",
            ctx.accounts.user.key(),
            user_staking_account.staked_amount
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
        let mut tournament_id_bytes = [0u8; 10]; // 10-byte fixed array
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(10); // Limit to 10 bytes
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);

        // Assign values to PDA
        tournament_pool.admin = admin.key();
        tournament_pool.mint = ctx.accounts.mint.key();
        tournament_pool.tournament_id = tournament_id_bytes;
        tournament_pool.entry_fee = entry_fee;
        tournament_pool.total_funds = 0;
        tournament_pool.participant_count = 0;
        tournament_pool.max_participants = max_participants;
        tournament_pool.end_time = end_time;
        tournament_pool.is_active = true;
        tournament_pool.bump = ctx.bumps.tournament_pool;

        msg!(
            "Tournament '{}' created by admin: {} with entry fee: {} and max participants: {}",
            tournament_id,
            admin.key(),
            entry_fee,
            max_participants
        );

        Ok(())
    }

    pub fn register_for_tournament(
        ctx: Context<RegisterForTournament>,
        _tournament_id: String,
    ) -> Result<()> {
        let tournament_pool = &mut ctx.accounts.tournament_pool;
        let user_token_account = &mut ctx.accounts.user_token_account;
        let user = &ctx.accounts.user;
        let mint = &ctx.accounts.mint;

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

        // Check if user has sufficient funds
        let entry_fee = tournament_pool.entry_fee;
        let balance = user_token_account.amount;
        require!(balance >= entry_fee, TournamentError::InsufficientFunds);

        // Create registration record if not already exists
        let registration_account = &mut ctx.accounts.registration_account;
        require!(
            registration_account.is_initialized == false,
            TournamentError::AlreadyRegistered
        );

        // Register user
        registration_account.user = user.key();
        registration_account.tournament_pool = tournament_pool.key();
        registration_account.is_initialized = true;
        registration_account.registration_time = current_time;
        registration_account.bump = ctx.bumps.registration_account;

        // Transfer entry fee to escrow account
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: user_token_account.to_account_info(),
                to: ctx.accounts.pool_escrow_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: user.to_account_info(),
            },
        );

        // Get decimals from mint account instead of hardcoding
        let decimals = mint.decimals;

        token_2022::transfer_checked(transfer_ctx, entry_fee, decimals)?;

        // Update tournament pool
        tournament_pool.total_funds += entry_fee;
        tournament_pool.participant_count += 1;

        msg!(
            "User {} registered for tournament {} with {} tokens.",
            user.key(),
            String::from_utf8_lossy(&tournament_pool.tournament_id),
            entry_fee
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

    // New instruction to initialize a prize pool for a specific tournament
    pub fn initialize_prize_pool(
        ctx: Context<InitializePrizePool>,
        tournament_id: String,
    ) -> Result<()> {
        let prize_pool = &mut ctx.accounts.prize_pool;
        let admin = &ctx.accounts.admin;
        let tournament_pool = &ctx.accounts.tournament_pool;

        // Convert tournament_id to fixed-size bytes
        let mut tournament_id_bytes = [0u8; 10];
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(10);
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);

        // Verify that the tournament_id matches the one in the tournament pool
        // Compare the tournament_id bytes
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

    // MODIFIED FUNCTION: Now uses admin as direct signer for token transfers
    pub fn distribute_tournament_revenue(
        ctx: Context<DistributeTournamentRevenue>,
        tournament_id: String,
        prize_percentage: u8,   // Default 40%
        revenue_percentage: u8, // Default 50%
        staking_percentage: u8, // Default 5%
        burn_percentage: u8,    //Default 5%
    ) -> Result<()> {
        // Validate the percentage splits add up to 100%
        require!(
            prize_percentage + revenue_percentage + staking_percentage + burn_percentage == 100,
            TournamentError::InvalidPercentages
        );

        // Convert tournament_id to bytes
        let mut tournament_id_bytes = [0u8; 10];
        let id_bytes = tournament_id.as_bytes();
        let len = id_bytes.len().min(10);
        tournament_id_bytes[..len].copy_from_slice(&id_bytes[..len]);

        // Ensure tournament is active and has funds
        require!(
            ctx.accounts.tournament_pool.is_active,
            TournamentError::TournamentNotActive
        );
        require!(
            ctx.accounts.tournament_pool.total_funds > 0,
            TournamentError::InsufficientFunds
        );

        // Verify that this prize pool matches the tournament ID
        require!(
            ctx.accounts.prize_pool.tournament_id == tournament_id_bytes,
            TournamentError::Unauthorized
        );

        // Calculate distributions
        let total_funds = ctx.accounts.tournament_pool.total_funds;
        let prize_amount = (total_funds * prize_percentage as u64) / 100;
        let revenue_amount = (total_funds * revenue_percentage as u64) / 100;
        let staking_amount = (total_funds * staking_percentage as u64) / 100;
        let burn_amount = (total_funds * burn_percentage as u64) / 100;

        // Get mint decimals
        let mint_decimals = ctx.accounts.mint.decimals;

        // 1. Transfer to prize pool using admin as direct signer
        if prize_amount > 0 {
            token_2022::transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::TransferChecked {
                        from: ctx.accounts.tournament_escrow_account.to_account_info(),
                        to: ctx.accounts.prize_escrow_account.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        authority: ctx.accounts.admin.to_account_info(), // Admin signs directly
                    },
                ),
                prize_amount,
                mint_decimals,
            )?;

            // Update prize pool info
            ctx.accounts.prize_pool.total_funds = ctx
                .accounts
                .prize_pool
                .total_funds
                .checked_add(prize_amount)
                .ok_or(StakingError::MathOverflow)?;
        }

        // 2. Transfer to revenue pool using admin as direct signer
        if revenue_amount > 0 {
            token_2022::transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::TransferChecked {
                        from: ctx.accounts.tournament_escrow_account.to_account_info(),
                        to: ctx.accounts.revenue_escrow_account.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        authority: ctx.accounts.admin.to_account_info(), // Admin signs directly
                    },
                ),
                revenue_amount,
                mint_decimals,
            )?;

            // Update revenue pool info
            ctx.accounts.revenue_pool.total_funds = ctx
                .accounts
                .revenue_pool
                .total_funds
                .checked_add(revenue_amount)
                .ok_or(StakingError::MathOverflow)?;
        }

        // 3. Transfer to staking pool using admin as direct signer
        if staking_amount > 0 {
            token_2022::transfer_checked(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::TransferChecked {
                        from: ctx.accounts.tournament_escrow_account.to_account_info(),
                        to: ctx.accounts.staking_escrow_account.to_account_info(),
                        mint: ctx.accounts.mint.to_account_info(),
                        authority: ctx.accounts.admin.to_account_info(), // Admin signs directly
                    },
                ),
                staking_amount,
                mint_decimals,
            )?;

            // Update staking pool info
            ctx.accounts.staking_pool.total_staked = ctx
                .accounts
                .staking_pool
                .total_staked
                .checked_add(staking_amount)
                .ok_or(StakingError::MathOverflow)?;
        }

        //4. Burn tokens
        if burn_amount > 0 {
            //Burn tokens directly from the tournament escrow
            token_2022::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token_2022::Burn {
                        mint: ctx.accounts.mint.to_account_info(),
                        from: ctx.accounts.tournament_escrow_account.to_account_info(),
                        authority: ctx.accounts.admin.to_account_info(), //Admin signs for it
                    },
                ),
                burn_amount,
            )?;
            msg!("Burned {} tokens", burn_amount);
        }

        // Set tournament as inactive after distribution
        ctx.accounts.tournament_pool.is_active = false;
        ctx.accounts.tournament_pool.total_funds = 0; // Reset pool funds as they've been distributed

        // Update timestamp of distribution
        let current_time = Clock::get()?.unix_timestamp;
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

    pub fn distribute_tournament_prizes(
        ctx: Context<DistributeTournamentPrizes>,
        tournament_id: String,
    ) -> Result<()> {
        // Fixed percentages for the top 3 positions
        const PERCENTAGES: [u8; 3] = [50, 30, 20];

        // Verify tournament ID matches
        let tournament_id_bytes = tournament_id.as_bytes();
        let mut tournament_id_fixed = [0u8; 10];
        let len = tournament_id_bytes.len().min(10);
        tournament_id_fixed[..len].copy_from_slice(&tournament_id_bytes[..len]);
        require!(
            ctx.accounts.prize_pool.tournament_id == tournament_id_fixed,
            TournamentError::Unauthorized
        );

        // Ensure prize pool hasn't been distributed yet
        require!(
            !ctx.accounts.prize_pool.distributed,
            TournamentError::AlreadyDistributed
        );

        // Get total funds in prize pool and mint decimals
        let total_prize_funds = ctx.accounts.prize_pool.total_funds;
        let mint_decimals = ctx.accounts.mint.decimals;

        // Create a long-lived value for the tournament pool key
        let tournament_pool_key = ctx.accounts.tournament_pool.key();

        // Get the seeds for PrizePool PDA signing
        let prize_pool_seeds = &[
            b"prize_pool".as_ref(),
            tournament_pool_key.as_ref(),
            &[ctx.accounts.prize_pool.bump],
        ];
        let signer_seeds = &[&prize_pool_seeds[..]];

        // Array of token accounts
        let winner_accounts = [
            &ctx.accounts.first_place_token_account,
            &ctx.accounts.second_place_token_account,
            &ctx.accounts.third_place_token_account,
        ];

        // Distribute to each winner - NOW USING PRIZE POOL PDA AS AUTHORITY
        for (i, token_account) in winner_accounts.iter().enumerate() {
            let percentage = PERCENTAGES[i] as u64;
            let prize_amount = (total_prize_funds * percentage) / 100;

            if prize_amount > 0 {
                // Transfer from prize escrow to winner's token account with PrizePool PDA as signer
                token_2022::transfer_checked(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        token_2022::TransferChecked {
                            from: ctx.accounts.prize_escrow_account.to_account_info(),
                            to: token_account.to_account_info(),
                            mint: ctx.accounts.mint.to_account_info(),
                            authority: ctx.accounts.prize_pool.to_account_info(), // PrizePool PDA is the authority
                        },
                        signer_seeds,
                    ),
                    prize_amount,
                    mint_decimals,
                )?;

                msg!(
                    "Transferred {} tokens to winner at rank {}: {}",
                    prize_amount,
                    i + 1,
                    token_account.owner
                );
            }
        }

        // Mark prize pool as distributed
        ctx.accounts.prize_pool.distributed = true;
        msg!("✅ Tournament prizes distributed successfully!");

        Ok(())
    }

    #[derive(Accounts)]
    #[instruction(tournament_id: String)]
    pub struct DistributeTournamentPrizes<'info> {
        #[account(mut, constraint = admin.key() == prize_pool.admin @ TournamentError::Unauthorized)]
        pub admin: Signer<'info>,

        #[account(
        mut,
        seeds = [b"prize_pool", tournament_pool.key().as_ref()],
        bump = prize_pool.bump
    )]
        pub prize_pool: Account<'info, PrizePool>,

        #[account(
        constraint = tournament_pool.key() == prize_pool.tournament_pool @ TournamentError::Unauthorized
    )]
        pub tournament_pool: Account<'info, TournamentPool>,

        #[account(
        mut,
        token::mint = mint,
        token::authority = prize_pool // Changed: PrizePool PDA is the authority, not admin
    )]
        pub prize_escrow_account: InterfaceAccount<'info, TokenAccount>,

        // Winner token accounts
        #[account(mut, constraint = first_place_token_account.mint == mint.key())]
        pub first_place_token_account: InterfaceAccount<'info, TokenAccount>,

        #[account(mut, constraint = second_place_token_account.mint == mint.key())]
        pub second_place_token_account: InterfaceAccount<'info, TokenAccount>,

        #[account(mut, constraint = third_place_token_account.mint == mint.key())]
        pub third_place_token_account: InterfaceAccount<'info, TokenAccount>,

        #[account(mut, constraint = mint.key() == prize_pool.mint)]
        pub mint: InterfaceAccount<'info, Mint>,

        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }

    // Corrected Accounts for GameHub Program
    #[derive(Accounts)]
    #[instruction(tournament_id: String, entry_fee: u64, max_participants: u16, end_time: i64)]
    pub struct CreateTournamentPool<'info> {
        #[account(
            init,
            payer = admin,
            space = 8  // Discriminator
                    + 32  // Admin pubkey
                    + 32  // Mint pubkey
                    + 10  // Tournament ID (fixed-size array)
                    + 8  // Entry fee
                    + 8  // Total funds
                    + 2  // Participant count
                    + 2  // Max participants
                    + 8  // End time
                    + 1  // is_active (bool)
                    + 1,  // bump  // Adjusted for new fields
            seeds = [b"tournament_pool", admin.key().as_ref(), tournament_id.as_bytes()],
            bump
        )]
        pub tournament_pool: Account<'info, TournamentPool>,

        #[account(
            init,
            payer = admin,
            token::mint = mint,
            token::authority = admin, // Admin is authority for this specific account
            seeds = [b"escrow", tournament_pool.key().as_ref()],  // Unique escrow PDA
            bump
        )]
        pub pool_escrow_account: InterfaceAccount<'info, TokenAccount>,

        pub mint: InterfaceAccount<'info, Mint>,
        #[account(mut)]
        pub admin: Signer<'info>,
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }

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

        #[account(mut, constraint = user_token_account.mint == tournament_pool.mint)]
        pub user_token_account: InterfaceAccount<'info, TokenAccount>,

        #[account(
            mut,
            token::mint = tournament_pool.mint,
            token::authority = tournament_pool.admin
        )]
        pub pool_escrow_account: InterfaceAccount<'info, TokenAccount>,

        #[account(mut, constraint = mint.key() == tournament_pool.mint)]
        pub mint: InterfaceAccount<'info, Mint>,

        pub token_program: Program<'info, Token2022>,
        pub system_program: Program<'info, System>,
    }

    // Accounts struct for the global revenue pool initialization
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
            init_if_needed,
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

    // Accounts struct for tournament-specific prize pool initialization
    #[derive(Accounts)]
    #[instruction(tournament_id: String)]
    pub struct InitializePrizePool<'info> {
        #[account(
            init,
            payer = admin,
            space = 8 + 32 + 32 + 32 + 10 + 8 + 1 + 1,
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

    // MODIFIED: This is the key account struct where we use admin as direct authority
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
            bump = prize_pool.bump,
            constraint = prize_pool.admin == admin.key() @ TournamentError::Unauthorized
        )]
        pub prize_pool: Account<'info, PrizePool>,

        #[account(
            mut,
            seeds = [b"revenue_pool", admin.key().as_ref()],
            bump = revenue_pool.bump,
            constraint = revenue_pool.admin == admin.key() @ TournamentError::Unauthorized
        )]
        pub revenue_pool: Account<'info, RevenuePool>,

        #[account(
            mut,
            seeds = [b"staking_pool", admin.key().as_ref()],
            bump = staking_pool.bump,
            constraint = staking_pool.admin == admin.key() @ TournamentError::Unauthorized
        )]
        pub staking_pool: Account<'info, StakingPool>,

        #[account(
            mut,
            token::mint = mint,
            token::authority = admin, // Admin is the direct authority
        )]
        pub tournament_escrow_account: InterfaceAccount<'info, TokenAccount>,

        #[account(
            mut,
            token::mint = mint,
            token::authority = prize_pool
        )]
        pub prize_escrow_account: InterfaceAccount<'info, TokenAccount>,

        #[account(
            mut,
            token::mint = mint,
            token::authority = revenue_pool
        )]
        pub revenue_escrow_account: InterfaceAccount<'info, TokenAccount>,

        #[account(
            mut,
            token::mint = mint,
            token::authority = staking_pool
        )]
        pub staking_escrow_account: InterfaceAccount<'info, TokenAccount>,

        #[account(mut, constraint = mint.key() == tournament_pool.mint)]
        pub mint: InterfaceAccount<'info, Mint>,

        pub token_program: Program<'info, Token2022>,
    }

    #[derive(Accounts)]
    pub struct InitializeAccounts<'info> {
        #[account(
                init_if_needed,
                payer = admin,
                space = 8 + 32 + 32 + 8 + 1,
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

        pub mint: InterfaceAccount<'info, Mint>,
        #[account(mut)]
        pub admin: Signer<'info>,
        pub system_program: Program<'info, System>,
        pub token_program: Program<'info, Token2022>,
    }

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
                space = 8 + 32 + 8 + 8 + 8,
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
            seeds = [b"user_stake", user.key().as_ref()],
            bump,
            close = user
        )]
        pub user_staking_account: Account<'info, UserStakingAccount>,

        #[account(mut)]
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
    }
    const ONE_MONTH: i64 = 30 * 24 * 60 * 60;
    const THREE_MONTHS: i64 = 3 * ONE_MONTH;
    const SIX_MONTHS: i64 = 6 * ONE_MONTH;
    const TWELVE_MONTHS: i64 = 12 * ONE_MONTH;

    #[account]
    pub struct StakingPool {
        pub admin: Pubkey,
        pub mint: Pubkey,
        pub total_staked: u64,
        pub bump: u8,
    }

    #[account]
    pub struct UserStakingAccount {
        pub owner: Pubkey,
        pub staked_amount: u64,
        pub stake_timestamp: i64,
        pub lock_duration: i64,
    }

    #[account]
    pub struct TournamentPool {
        pub admin: Pubkey,
        pub mint: Pubkey,
        pub tournament_id: [u8; 10],
        pub entry_fee: u64,
        pub total_funds: u64,
        pub participant_count: u16,
        pub max_participants: u16,
        pub end_time: i64,
        pub is_active: bool,
        pub bump: u8,
    }

    #[account]
    pub struct RegistrationRecord {
        pub user: Pubkey,
        pub tournament_pool: Pubkey,
        pub is_initialized: bool,
        pub registration_time: i64,
        pub bump: u8,
    }

    // New accounts to add to the contract
    #[account]
    pub struct PrizePool {
        pub admin: Pubkey,           // Admin who controls the prize pool
        pub tournament_pool: Pubkey, // Tournament pool this prize pool is linked to
        pub mint: Pubkey,            // Token mint address
        pub tournament_id: [u8; 10], // Tournament ID linked to this prize pool
        pub total_funds: u64,        // Total funds in prize pool
        pub distributed: bool,       // Whether prizes have been distributed
        pub bump: u8,                // Bump for PDA derivation
    }

    #[account]
    pub struct RevenuePool {
        pub admin: Pubkey,          // Admin public key
        pub mint: Pubkey,           // Token mint address
        pub total_funds: u64,       // Total funds accumulated in the revenue pool
        pub last_distribution: i64, // Timestamp of last distribution
        pub bump: u8,               // Bump for PDA derivation
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
