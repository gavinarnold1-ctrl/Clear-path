import posthog from 'posthog-js'

// ── User identification ─────────────────────────────────

export function identifyUser(userId: string, properties: {
  email?: string
  name?: string
  goal?: string | null
  household_type?: string | null
  income_range?: string | null
  account_count?: number
  has_plaid?: boolean
  has_properties?: boolean
  signup_date?: string
  is_demo?: boolean
}) {
  if (typeof window === 'undefined') return
  posthog.identify(userId, properties)
}

export function resetUser() {
  if (typeof window === 'undefined') return
  posthog.reset()
}

// ── Generic event tracking ──────────────────────────────

export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  posthog.capture(event, properties)
}

// ── Typed event helpers ─────────────────────────────────

// Auth
export const trackSignup = (method: 'email' | 'demo') =>
  track('user_signed_up', { method })

export const trackLogin = (method: 'email' | 'demo') =>
  track('user_logged_in', { method })

export const trackLogout = () =>
  track('user_logged_out')

// Onboarding
export const trackOnboardingStep = (step: number, stepName: string, properties?: Record<string, unknown>) =>
  track('onboarding_step_completed', { step, step_name: stepName, ...properties })

export const trackOnboardingComplete = (durationSeconds: number, goal: string) =>
  track('onboarding_completed', { duration_seconds: durationSeconds, goal })

// Transactions
export const trackTransactionCreated = (isManual: boolean) =>
  track('transaction_created', { is_manual: isManual })

export const trackTransactionUpdated = (fieldsChanged: string[]) =>
  track('transaction_updated', { fields_changed: fieldsChanged })

export const trackTransactionCategorized = (method: 'manual' | 'auto' | 'bulk', categoryName: string) =>
  track('transaction_categorized', { method, category_name: categoryName })

export const trackTransactionImported = (source: 'csv' | 'plaid', count: number) =>
  track('transaction_imported', { source, count })

export const trackTransactionsFiltered = (filterType: string, filterCount: number) =>
  track('transactions_filtered', { filter_type: filterType, filter_count: filterCount })

export const trackTransactionsSorted = (column: string, direction: 'asc' | 'desc') =>
  track('transactions_sorted', { column, direction })

export const trackTransactionsSearched = (hasResults: boolean) =>
  track('transactions_searched', { has_results: hasResults })

// Budgets
export const trackBudgetCreated = (tier: string, amount: number) =>
  track('budget_created', { tier, amount })

export const trackBudgetUpdated = (tier: string, fieldsChanged: string[]) =>
  track('budget_updated', { tier, fields_changed: fieldsChanged })

export const trackBudgetDeleted = (tier: string) =>
  track('budget_deleted', { tier })

export const trackBudgetPageViewed = (budgetCount: number, tiers: string[]) =>
  track('budget_page_viewed', { budget_count: budgetCount, tiers })

// Annual Expenses
export const trackAnnualExpenseCreated = (annualAmount: number, dueMonth: number, isRecurring: boolean) =>
  track('annual_expense_created', { annual_amount: annualAmount, due_month: dueMonth, is_recurring: isRecurring })

export const trackAnnualExpenseFunded = (amount: number, method: 'manual' | 'auto') =>
  track('annual_expense_funded', { amount, method })

export const trackAnnualPlanViewed = (expenseCount: number, totalAnnual: number) =>
  track('annual_plan_viewed', { expense_count: expenseCount, total_annual: totalAnnual })

// Debts
export const trackDebtCreated = (type: string, balance: number, rate: number) =>
  track('debt_created', { type, balance, rate })

export const trackDebtsPageViewed = (debtCount: number, totalBalance: number) =>
  track('debts_page_viewed', { debt_count: debtCount, total_balance: totalBalance })

// Goals
export const trackGoalSet = (archetype: string, source: 'onboarding' | 'settings') =>
  track('goal_set', { archetype, source })

export const trackGoalChanged = (fromArchetype: string, toArchetype: string) =>
  track('goal_changed', { from_archetype: fromArchetype, to_archetype: toArchetype })

export const trackGoalTargetSet = (metric: string, targetValue: number, targetDate: string) =>
  track('goal_target_set', { metric, target_value: targetValue, target_date: targetDate })

export const trackGoalProgressViewed = (progressPercent: number, pace: string) =>
  track('goal_progress_viewed', { progress_percent: progressPercent, pace })

// Forecast
export const trackForecastViewed = (goalArchetype: string, pace: string, confidence: string) =>
  track('forecast_viewed', { goal_archetype: goalArchetype, pace, confidence })

export const trackScenarioViewed = (scenarioType: string, scenarioLabel: string) =>
  track('scenario_viewed', { scenario_type: scenarioType, scenario_label: scenarioLabel })

export const trackScenarioCustomized = (scenarioType: string, parameterChanged: string) =>
  track('scenario_customized', { scenario_type: scenarioType, parameter_changed: parameterChanged })

// Spending Analytics
export const trackAnalyticsPageViewed = (timePeriod: string) =>
  track('analytics_page_viewed', { time_period: timePeriod })

export const trackCategoryDeepDiveViewed = (categoryName: string) =>
  track('category_deep_dive_viewed', { category_name: categoryName })

// AI Insights
export const trackInsightsGenerated = (count: number, goalArchetype: string) =>
  track('insights_generated', { count, goal_archetype: goalArchetype })

export const trackInsightCompleted = (type: string, category: string, savingsAmount: number) =>
  track('insight_completed', { type, category, savings_amount: savingsAmount })

export const trackInsightDismissed = (type: string, reason: string) =>
  track('insight_dismissed', { type, reason })

// Monthly Review
export const trackMonthlyReviewViewed = (month: string, savingsRate: number, efficiencyScore: number) =>
  track('monthly_review_viewed', { month, savings_rate: savingsRate, efficiency_score: efficiencyScore })

// Accounts
export const trackAccountConnected = (method: 'plaid' | 'manual', type: string, institution?: string) =>
  track('account_connected', { method, type, institution })

export const trackPlaidSyncCompleted = (added: number, modified: number) =>
  track('plaid_sync_completed', { transactions_added: added, transactions_modified: modified })

// Properties
export const trackPropertyCreated = (type: string, hasMortgage: boolean) =>
  track('property_created', { type, has_mortgage: hasMortgage })

// Credit Card Benefits
export const trackCardIdentified = (programName: string, method: 'plaid_auto' | 'manual') =>
  track('card_identified', { program_name: programName, method })

export const trackBenefitsViewed = (cardCount: number) =>
  track('benefits_viewed', { card_count: cardCount })

// Landing Page
export const trackLandingPageViewed = (referrer: string) =>
  track('landing_page_viewed', { referrer })

export const trackWaitlistSignup = () =>
  track('waitlist_signup')

export const trackCtaClicked = (ctaText: string, location: string) =>
  track('cta_clicked', { cta_text: ctaText, location })

// Feedback
export const trackFeedbackSubmitted = (type: string, page: string) =>
  track('feedback_submitted', { type, page })

// Income Transitions
export const trackIncomeTransitionViewed = (transitionCount: number, nextTransitionMonths: number) =>
  track('forecast_income_transition_viewed', { transition_count: transitionCount, next_transition_months: nextTransitionMonths })

export const trackDebtAccelerationViewed = (debtCount: number, monthsSaved: number, interestSaved: number) =>
  track('debt_acceleration_viewed', { debt_count: debtCount, months_saved: monthsSaved, interest_saved: interestSaved })

export const trackGoalDeferAccelerationShown = (goalArchetype: string, phasedContributionCount: number) =>
  track('goal_defer_acceleration_shown', { goal_archetype: goalArchetype, phased_contribution_count: phasedContributionCount })

export const trackDemoPhysicianLoaded = () =>
  track('demo_physician_loaded')

// Navigation
export const trackPageViewed = (path: string, title: string) =>
  track('page_viewed', { path, title })

export const trackSidebarNavClicked = (destination: string) =>
  track('sidebar_nav_clicked', { destination })
