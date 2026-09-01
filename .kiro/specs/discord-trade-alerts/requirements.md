# Requirements Document

## Introduction

The Discord Trade Alerts feature extends TradingParadise with the ability to ingest trade alerts posted in Discord communities the user belongs to, and store them within the App for later review. The user participates in multiple Discord communities, each containing one or more chat rooms where members post options trade alerts. The user submits trade alerts to the App by pasting the alert text, or via an optional inbound webhook a community may configure, and the App parses, classifies, and persists each alert scoped to the community and chat room it originated from. Automatically reading a Discord channel with a Discord bot is a planned future capability, and the ingestion design keeps the alert source swappable so a live reader can be added later without changing the stored data model.

Trade alerts describe an action to take on an options position and fall into one of three action types: opening a trade, adjusting an existing trade, or closing a trade. Alerts vary widely in format across communities and are written as free-form text, sometimes accompanied by links and images.

For the initial build, the feature targets a single community ("Mak's Money Maker Club", chat room "elite-trade-alerts") and captures only alerts that open a trade. The data model and ingestion design account for multiple communities, multiple chat rooms, and all three action types so the feature can expand without rework. The Discord Trade Alerts feature is presented as a separate section of the App, reachable from the left sidebar, and stores all data in Supabase under per-user Row Level Security consistent with existing App features.

## Glossary

- **App**: The TradingParadise application being extended.
- **Discord_Alerts**: The Discord Trade Alerts feature section of the App, responsible for ingesting, storing, and displaying trade alerts.
- **Community**: A Discord server or community the user belongs to, identified by a name (e.g., "Mak's Money Maker Club"). A Community contains one or more Chat_Rooms.
- **Chat_Room**: A specific channel within a Community from which trade alerts are read (e.g., "elite-trade-alerts").
- **Alert_Source**: The combination of a Community and a Chat_Room that identifies where a Trade_Alert originated.
- **Trade_Alert**: An options trade action submitted to the App (by manual paste or an optional inbound webhook) and stored for review, scoped to the Alert_Source it originated from.
- **Action_Type**: The classification of a Trade_Alert as one of Open, Adjust, or Close.
- **Open_Alert**: A Trade_Alert with an Action_Type of Open, indicating a new position is being entered.
- **Adjust_Alert**: A Trade_Alert with an Action_Type of Adjust, indicating an existing position is being modified.
- **Close_Alert**: A Trade_Alert with an Action_Type of Close, indicating an existing position is being exited.
- **Ingestion_Service**: The component of Discord_Alerts responsible for accepting a submitted alert (via manual paste or an optional inbound webhook) and creating a Trade_Alert. The Ingestion_Service is designed around a swappable alert source so a live Discord bot reader can be added in a later build.
- **Message_Id**: An identifier for a submitted alert used to prevent storing the same alert more than once. For manually pasted alerts the App derives this identifier from the alert content and Alert_Source; for webhook or future bot ingestion it is the identifier provided by the source.
- **Raw_Content**: The original, unmodified text of a submitted alert captured as part of a Trade_Alert.
- **Alert_Submission**: The act of providing an alert's text to the Ingestion_Service, either by the user pasting it or via an optional inbound webhook.
- **Alert_Parser**: The component of Discord_Alerts responsible for classifying a message's Action_Type and extracting structured fields from Raw_Content.
- **Alert_Viewer**: The component of Discord_Alerts responsible for displaying stored Trade_Alerts to the user.
- **User**: The authenticated owner of the App account whose data is protected by Row Level Security.

## Requirements

### Requirement 1: Discord Alerts Navigation

**User Story:** As a user, I want a dedicated Discord Alerts section reachable from the sidebar, so that I can review trade alerts separately from my other App sections.

#### Acceptance Criteria

1. THE App SHALL display a Discord Alerts navigation item in the left sidebar alongside the Trading Plans, Trade Journal, Portfolio, Notes, and Dashboard navigation items.
2. WHEN a user selects the Discord Alerts navigation item, THE App SHALL navigate to the Discord_Alerts section and display the Alert_Viewer as the active content.
3. WHILE the Discord_Alerts section is active, THE App SHALL visually indicate the Discord Alerts navigation item as selected and SHALL indicate no other navigation item as selected.
4. THE Discord_Alerts section SHALL be presented as a section separate from the Trading Plans, Trade Journal, Portfolio, Notes, and Dashboard sections such that its content does not appear within any of those sections.
5. IF the Alert_Viewer fails to load after the Discord_Alerts section is selected, THEN THE App SHALL display an error indication that loading failed and SHALL retain the Discord Alerts navigation item as the selected item.

### Requirement 2: Alert Source Management

**User Story:** As a user, I want to configure which community and chat room to read alerts from, so that alerts are captured from the correct source and organized accordingly.

#### Acceptance Criteria

1. THE Discord_Alerts SHALL allow the user to configure between 1 and 50 Alert_Sources, each consisting of a Community name of 1 to 100 characters and a Chat_Room name of 1 to 100 characters.
2. WHEN a user submits an Alert_Source with a non-empty Community name and a non-empty Chat_Room name, THE Discord_Alerts SHALL store the Alert_Source and SHALL display it in the list of configured Alert_Sources.
3. IF a user submits an Alert_Source with an empty Community name or an empty Chat_Room name, THEN THE Discord_Alerts SHALL display a validation error and SHALL NOT create the Alert_Source.
4. THE Discord_Alerts SHALL store each Trade_Alert with a reference to the Alert_Source it originated from.
5. IF a user attempts to configure an Alert_Source whose Community name and Chat_Room name match an existing Alert_Source when compared case-insensitively and with leading and trailing whitespace trimmed, THEN THE Discord_Alerts SHALL display a validation error and SHALL prevent creation of the duplicate Alert_Source.
6. THE Discord_Alerts SHALL allow the user to edit and delete existing Alert_Sources.
7. IF a user deletes an Alert_Source that has associated Trade_Alerts, THEN THE Discord_Alerts SHALL display the count of associated Trade_Alerts, SHALL prompt the user to confirm deletion with a warning that the associated Trade_Alerts will also be deleted, and SHALL retain the Alert_Source and its Trade_Alerts until the user confirms.

### Requirement 3: Message Ingestion

**User Story:** As a user, I want to submit a trade alert by pasting its text (or have a community forward it via a webhook), so that alerts are captured and organized without violating Discord's terms or requiring admin access to a server.

#### Acceptance Criteria

1. WHEN a user submits an Alert_Submission for a selected Alert_Source by pasting alert text, THE Ingestion_Service SHALL capture the Raw_Content up to a maximum of 10,000 characters and SHALL associate it with the selected Alert_Source.
2. WHEN the Ingestion_Service accepts an Alert_Submission, THE Ingestion_Service SHALL record a submission timestamp and SHALL derive a Message_Id for the submission.
3. IF an Alert_Submission has Raw_Content that is empty or contains only whitespace, THEN THE Ingestion_Service SHALL reject the submission, SHALL NOT create a Trade_Alert, and SHALL display a validation message.
4. IF an Alert_Submission has a Message_Id that matches an existing Trade_Alert for the same Alert_Source, THEN THE Ingestion_Service SHALL reject the submission as a duplicate and SHALL NOT create a duplicate Trade_Alert.
5. WHEN the Ingestion_Service creates a Trade_Alert from an Alert_Submission, THE Ingestion_Service SHALL report to the user whether the submission was stored, skipped as a duplicate, or rejected as invalid.
6. THE Ingestion_Service SHALL obtain Alert_Submissions through a swappable alert source so that additional sources, including an optional inbound webhook and a future live Discord bot reader, can be added without changing the Trade_Alert data model.

### Requirement 4: Open Alert Classification

**User Story:** As a user, I want the App to identify which messages are open-trade alerts, so that only relevant alerts are stored during the initial build.

#### Acceptance Criteria

1. WHEN the Alert_Parser evaluates the Raw_Content of an Alert_Submission, THE Alert_Parser SHALL assign it exactly one Action_Type from the set {Open, Adjust, Close, Unclassified}.
2. WHEN the Alert_Parser evaluates the same Raw_Content more than once, THE Alert_Parser SHALL assign the same Action_Type on every evaluation.
3. IF an Alert_Submission's Raw_Content is empty, malformed, or does not match the criteria for Open, Adjust, or Close, THEN THE Alert_Parser SHALL assign an Action_Type of Unclassified.
4. WHERE the initial build is active, WHEN the Alert_Parser assigns an Alert_Submission an Action_Type of Open, THE Ingestion_Service SHALL create exactly one Trade_Alert for that submission.
5. WHERE the initial build is active, IF an Alert_Submission is assigned an Action_Type of Adjust, Close, or Unclassified, THEN THE Ingestion_Service SHALL NOT create a Trade_Alert and SHALL inform the user that the submission was not stored.
6. THE Alert_Parser SHALL assign the Action_Type values Adjust and Close using the same stored data model as the Open Action_Type, such that enabling ingestion of Adjust and Close Action_Types in a later build requires no change to the Trade_Alert data model.

### Requirement 5: Open Alert Field Extraction

**User Story:** As a user, I want the App to extract the key details from an open-trade alert, so that I can review structured trade information instead of raw text.

#### Acceptance Criteria

1. WHEN the Alert_Parser processes an Open_Alert, THE Alert_Parser SHALL extract each of the following fields when present in the Raw_Content: the underlying asset symbol, the option strategy description, the expiration date, the strike price or price levels, the direction, and the fill price.
2. WHEN the Alert_Parser extracts the direction from an Open_Alert, THE Alert_Parser SHALL record the direction as exactly one of the values "buy" or "sell".
3. WHEN the Alert_Parser processes an Open_Alert that reports a credit or debit amount, THE Alert_Parser SHALL extract the amount and SHALL record whether the amount is a credit or a debit.
4. IF a field defined in acceptance criterion 1 is absent from the Raw_Content, THEN THE Alert_Parser SHALL record that field as not present and SHALL retain the complete Raw_Content for the Trade_Alert.
5. IF a field defined in acceptance criterion 1 is present in the Raw_Content but its value cannot be recognized as a valid value for that field, THEN THE Alert_Parser SHALL record that field as not present and SHALL retain the complete Raw_Content for the Trade_Alert.
6. IF the Raw_Content of an Open_Alert is empty or contains no recognizable field defined in acceptance criterion 1, THEN THE Alert_Parser SHALL record all fields as not present, SHALL retain the complete Raw_Content for the Trade_Alert, and SHALL produce an indication that no structured fields were extracted.
7. THE Trade_Alert SHALL retain the complete Raw_Content regardless of which structured fields the Alert_Parser extracts.
8. WHERE an Open_Alert contains one or more links, THE Alert_Parser SHALL extract and store each link with the Trade_Alert, up to a maximum of 50 links per Trade_Alert.

### Requirement 6: Trade Alert Persistence

**User Story:** As a user, I want ingested alerts saved reliably and scoped to my account, so that my alert history is preserved and private.

#### Acceptance Criteria

1. WHEN the Ingestion_Service creates a Trade_Alert, THE App SHALL persist the Trade_Alert to Supabase with the associated Alert_Source, Message_Id, Raw_Content, submission timestamp, Action_Type, and extracted structured fields.
2. IF persisting a Trade_Alert to Supabase fails, THEN THE App SHALL retain the unsaved Trade_Alert data, retry the persistence operation up to 3 times, and record a failure indication if all attempts are exhausted.
3. IF a Trade_Alert with a Message_Id and Alert_Source combination that already exists for the authenticated User is ingested, THEN THE App SHALL reject the duplicate and preserve the existing stored Trade_Alert unchanged.
4. THE App SHALL scope every Trade_Alert and Alert_Source to the authenticated User through Row Level Security so that a User can access only rows where the user identifier matches the authenticated user.
5. WHEN the Discord_Alerts section loads, THE App SHALL retrieve the authenticated User's stored Trade_Alerts grouped by Community and Chat_Room, and SHALL display an empty state when no Trade_Alerts exist.
6. WHEN the User confirms deletion of an individual Trade_Alert, THE App SHALL delete that Trade_Alert and remove it from the displayed alert history.
7. IF a deletion request targets a Trade_Alert whose user identifier does not match the authenticated User, THEN THE App SHALL reject the request and preserve the targeted Trade_Alert.

### Requirement 7: Trade Alert Display

**User Story:** As a user, I want to view stored alerts organized by community and chat room, so that I can review alerts from each source.

#### Acceptance Criteria

1. THE Alert_Viewer SHALL display stored Trade_Alerts grouped by Community and Chat_Room, with each group labeled by its Community name and Chat_Room name.
2. WHEN a user selects a Community and Chat_Room, THE Alert_Viewer SHALL display the Trade_Alerts for that Alert_Source sorted by submission timestamp in descending order, with the most recent timestamp first.
3. IF two or more Trade_Alerts for the selected Alert_Source share the same submission timestamp, THEN THE Alert_Viewer SHALL apply a deterministic secondary sort so that alert order is identical across repeated views.
4. WHEN the Alert_Viewer displays a Trade_Alert, THE Alert_Viewer SHALL display each extracted structured field with its field name and value, and SHALL provide a user-selectable control that reveals the complete Raw_Content of that Trade_Alert.
5. WHERE a Trade_Alert has one or more stored links, THE Alert_Viewer SHALL display each link as a navigable reference that, when selected, opens the link target.
6. WHEN the Alert_Viewer displays a Trade_Alert, THE Alert_Viewer SHALL display the Action_Type value of the Trade_Alert.
7. WHEN a user views an Alert_Source that has zero stored Trade_Alerts, THE Alert_Viewer SHALL display a message indicating no alerts are available for the selected Community and Chat_Room.
