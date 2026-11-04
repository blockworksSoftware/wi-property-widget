## Privacy - Work Item Property Widget

### Overview
Blockworks Software publishes the Work Item Property Widget for Azure DevOps. The widget runs inside your Azure DevOps dashboards and reads only the work item and property you configure.

For more information on security and privacy of Azure DevOps refer to [https://azure.microsoft.com/en-us/support/legal].

### Data storage
Your widget settings are stored in your Azure DevOps account, using the Azure DevOps extension data service. Only members of your account can read them. Blockworks Software does not receive your settings, work item content, or property values.

### Usage telemetry
The widget sends usage telemetry to Blockworks Software's Microsoft Application Insights resource, hosted in Azure (Central US). Telemetry is on by default. You can turn it off for each widget with **Enable Telemetry** in the widget's configuration. When it is off, that widget sends no telemetry.

The widget sends:
- Which features are used, for example Color, Date Format, Title, or Color Property. The values you enter are never sent.
- When a widget loads, and any error, with a short error code such as an HTTP status code. Error messages are not sent.
- A one-way hash (SHA-256) of your Azure DevOps user ID and organization ID. The hashes cannot be reversed to the original IDs. They identify a user or organization consistently, so they are personal data.
- Approximate location (country, region, and city) derived from the IP address by Application Insights.
- The time of each event and the widget version.

The widget does not send work item IDs or content, property names or values, titles, colors, date formats, or names and email addresses.

Adding the widget from a dashboard's context menu is counted as a feature use. The Enable Telemetry setting does not apply to this, because it happens before any widget is configured.

For more information about Application Insights please refer to [https://azure.microsoft.com/en-us/services/application-insights].

### Retention
- Detailed events, including location, are kept for 30 days.
- Monthly counts are kept for 13 months. They contain the number of distinct users and the number of feature uses per organization hash. They do not contain user hashes or location.

### Privacy
We collect only the data described above and use it to understand which features are used, how often, and whether errors occur. We do not sell it or share it outside Blockworks Software.

### Questions
Questions about this policy can be raised as an issue at https://github.com/blockworksSoftware/wi-property-widget/issues.

### Latest Privacy Policy
https://github.com/blockworksSoftware/wi-property-widget/blob/main/privacy.md
