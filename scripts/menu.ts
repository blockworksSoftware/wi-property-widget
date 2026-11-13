// ---------------------------------------------------------------------
// <copyright file="menu.ts">
//    This code is licensed under the MIT License.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//    PARTICULAR PURPOSE AND NONINFRINGEMENT.
// </copyright>
// <summary>Work item context menu: "Add Property Widget to dashboard"</summary>
// ---------------------------------------------------------------------
"use strict";
let DEBUG: boolean = false;
let logger = function(a: any, b: any) { if (DEBUG) { console.log(a, b || ""); } };

import Q = require("q");
import DashboardClient = require("TFS/Dashboards/RestClient");
import DashboardContracts = require("TFS/Dashboards/Contracts");
import CoreContracts = require("TFS/Core/Contracts");
import * as telemetry from "./telemetry";

// Where the context menu was opened. Each surface passes the work item ids differently.
type Surface = "queries" | "backlog" | "board" | "form" | "unknown";

function surfaceOf(context: any): Surface {
    if (context.ids) { return "queries"; }
    if (context.workItemIds) { return "backlog"; }
    if (context.id) { return "board"; }
    if (context.workItemId) { return "form"; }
    return "unknown";
}

function statusOf(error: any): string {
    const status = error && (error.status || error.statusCode);
    return status ? String(status) : "unknown";
}

export class WiMenu {
    private client = DashboardClient.getClient();
    // The team context that answered the dashboard list. The add uses the same one.
    private teamContext: CoreContracts.TeamContext = null;

    constructor(private surface: Surface = "unknown") {}

    // The team the host puts in the web context is not always a team of the project on
    // screen (pages without a team in the URL). A wrong team gives 404, so the project
    // scope is the fallback.
    private candidateContexts(): CoreContracts.TeamContext[] {
        const web = VSS.getWebContext();
        const candidates: CoreContracts.TeamContext[] = [];
        if (web.team && web.team.id) {
            candidates.push(<CoreContracts.TeamContext>{ projectId: web.project.id, project: web.project.name, teamId: web.team.id, team: web.team.name });
        }
        candidates.push(<CoreContracts.TeamContext>{ projectId: web.project.id, project: web.project.name });
        return candidates;
    }

    public getDashboards(): IPromise<DashboardContracts.Dashboard[]> {
        const candidates = this.candidateContexts();
        const hadTeam = candidates[0].teamId ? "yes" : "no";

        const attempt = (index: number): IPromise<DashboardContracts.Dashboard[]> => {
            const context = candidates[index];
            return this.client.getDashboards(context).then((group) => {
                this.teamContext = context;
                return group.dashboardEntries || [];
            }, (error) => {
                if (statusOf(error) === "404" && index + 1 < candidates.length) {
                    logger("getDashboards", "team not in this project, retrying at project scope");
                    return attempt(index + 1);
                }
                return Q.reject(error);
            });
        };

        return attempt(0).then((dashboards) => {
            // Counts only. No dashboard names, ids, or work item ids.
            telemetry.track(true, "MenuOpened", { surface: this.surface, team: hadTeam, dashboards: String(dashboards.length) });
            return dashboards;
        }, (error) => {
            logger("getDashboards", "Exception: " + (error && error.message));
            telemetry.trackError(true, "menu-dashboards-" + statusOf(error), { surface: this.surface, team: hadTeam });
            return Q.reject(error);
        });
    }

    public addWidgetToDashboard(dashboardId: string, wiid: string): IPromise<DashboardContracts.Widget> {
        const context = this.teamContext || this.candidateContexts()[0];
        return this.client.getDashboard(context, dashboardId).then((dashboard) => {
            const widget = <DashboardContracts.Widget><any>{
                name: "Work Item Property details",
                position: { row: 0, column: 0 },
                size: { rowSpan: 1, columnSpan: 2 },
                settings: JSON.stringify({ wiId: String(wiid) }),
                settingsVersion: { major: 1, minor: 0, patch: 0 },
                dashboard: { eTag: dashboard.eTag },
                contributionId: VSS.getExtensionContext().publisherId + "." + VSS.getExtensionContext().extensionId + ".wipropertywidget"
            };
            return this.client.createWidget(widget, context, dashboardId);
        }).then((created) => {
            logger("addWidgetToDashboard", "WI " + wiid + " added to dashboard " + dashboardId);
            return created;
        }, (error) => {
            logger("addWidgetToDashboard", "Exception: " + (error && error.message));
            telemetry.trackError(true, "menu-add-" + statusOf(error), { surface: this.surface });
            return Q.reject(error);
        });
    }
}

let contributionId = VSS.getExtensionContext().publisherId + "." + VSS.getExtensionContext().extensionId + ".addToDashboard-work-item-menu";
VSS.register(contributionId, {

    getMenuItems: (context) => {

        // Not all areas use the same format for passing work item ids. "ids" for Queries,
        // "workItemIds" for backlogs, "id" for boards, "workItemId" for the work item form.
        let ids = context.ids || context.workItemIds;
        if (!ids && context.id) {
            ids = [context.id];
        }
        if (!ids && context.workItemId) {
            ids = [context.workItemId];
        }

        const surface = surfaceOf(context);
        const w = new WiMenu(surface);

        return w.getDashboards().then((dashboards) => {
            const childItems = dashboards.map((dashboard) => <IContributedMenuItem>{
                text: dashboard.name,
                title: dashboard.name,
                action: () => {
                    telemetry.track(true, "AddToDashboard", { surface: surface });
                    ids.forEach((value) => {
                        w.addWidgetToDashboard(dashboard.id, value).then(() => { }, () => { });
                    });
                }
            });

            return [<IContributedMenuItem>{
                text: "Add Property Widget to dashboard",
                title: "Add Property Widget to dashboard",
                icon: "static/images/adddashboard.png",
                childItems: childItems
            }];
        }, () => {
            // Nothing to offer. The error has already been recorded.
            return <IContributedMenuItem[]>[];
        });
    }

});
