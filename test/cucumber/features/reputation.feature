Feature: Bidirectional Reputation System

  Scenario: Recalculating score after a completed reservation review
    Given a completed reservation between driver "driver-1" and renter "renter-1"
    When the driver leaves a 4-star review for the renter
    Then the system should recalculate the renter's score
    And the renter's score should be updated to 4.0

  Scenario: Low score renters get penalized in search
    Given a renter with a reputation score of 3.0
    When the system checks the renter's reputation
    Then the renter should be marked as having low reputation
    And their vehicles should be penalized in search rankings

  Scenario: Excellent drivers receive a badge
    Given a driver with a reputation score of 4.9 and 6 reviews
    When the system retrieves the driver's reputation
    Then the driver should receive the "conductor_destacado" badge

  Scenario: Applying a penalty for a confirmed report
    Given an open ticket "ticket-123" against a driver
    When support applies a 1.0 score deduction penalty for the ticket
    Then the driver's score should be reduced by 1.0
    And their penalty count should be incremented

  Scenario: Suspending a user after 3 penalties
    Given a driver with 2 existing penalties
    When support applies a 3rd penalty against the driver
    Then the driver should be marked as suspended
