// ---------------------------------------------------------------------
// <copyright file="app.ts">
//    This code is licensed under the MIT License.
//    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
//    ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
//    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
//    PARTICULAR PURPOSE AND NONINFRINGEMENT.
// </copyright>
// <summary>
// </summary>
// ---------------------------------------------------------------------

/// <reference path="jquery.dotdotdot.d.ts" />
"use strict";
let DEBUG: boolean = false;
let logger = function(a: any, b: any) { if (DEBUG) { console.log(a, b || ""); } };

import RestClient = require("TFS/Work/RestClient");
import CoreContracts = require("TFS/Core/Contracts");
import WorkContracts = require("TFS/Work/Contracts");
import RestClientWI = require("TFS/WorkItemTracking/RestClient");
import WorkItemsContracts = require("TFS/WorkItemTracking/Contracts");
import WorkItemServices = require("TFS/WorkItemTracking/Services");
import * as telemetry from "./telemetry";
import * as moment from "moment";
import { sanitizeHtml } from "./htmlSanitizer";
import { CustomTransportDataTypes } from "VSS/Ajax";

export class WidgetWIProperty {

    constructor(public WidgetHelpers) {
    }

    public client = RestClient.getClient();
    public clientwi = RestClientWI.getClient();

    public LoadWI(widgetSettings) {
        logger("LoadWI", "step 10");
        let customSettings = <ISettings>JSON.parse(widgetSettings.customSettings.data);
        logger("LoadWI", "step 12");
        let $title = $("h2");
        $title.text(widgetSettings.name);
        if (customSettings) {
            if (typeof customSettings.enableDebug === "undefined") {
                customSettings.enableDebug = false;
                logger("LoadWI", "enableDebug is undefined so set to " + customSettings.enableDebug);
            }
            logger("LoadWI", "debug = " + customSettings.enableDebug);
            DEBUG = customSettings.enableDebug;

            if (typeof customSettings.enableTelemetry === "undefined") {
                customSettings.enableTelemetry = true;
                logger("LoadWI", "enableTelemtry is undefined so set to " + customSettings.enableTelemetry);
            }
            logger("LoadWI", "enableTelemetry = " + customSettings.enableTelemetry);

            $("#configwidget").hide();
            $("#loadingwidget").show();
            $("#content").hide();
            $("#contentError").hide();

            // Main
            logger("LoadWI", "wiId = " + customSettings.wiId);
            if (customSettings.wiId) {
                this.clientwi.getWorkItem(customSettings.wiId).then((wi) => {
                    let $msg = "propertyName = " + customSettings.wiPropertyName + ";"
                        + " color prop = " + customSettings.wiColorPropertyName + ";"
                        + " color = " + customSettings.color + ";"
                        + " title = " + customSettings.title + ";"
                        + " dateFormat = " + customSettings.dateFormat + ";"
                        + " enableTelemetry = " + customSettings.enableTelemetry + ";"
                        + " enableDebug = " + customSettings.enableDebug + ";"
                        ;
                    logger("LoadWI", "values: " + $msg);

                    if (customSettings.color !== "") { telemetry.track(customSettings.enableTelemetry, "FeatureUsed", { feature: "Color" }); }
                    if (customSettings.dateFormat !== "") { telemetry.track(customSettings.enableTelemetry, "FeatureUsed", { feature: "DateFormat" }); }
                    if (customSettings.title !== "") { telemetry.track(customSettings.enableTelemetry, "FeatureUsed", { feature: "Title" }); }
                    if (customSettings.wiColorPropertyName !== "") { telemetry.track(customSettings.enableTelemetry, "FeatureUsed", { feature: "ColorProperty" }); }
                    // Feature names only. Property names, values, and work item IDs are never sent.

                    // Older or hand-written settings may have no property; show the title.
                    const propertyName = customSettings.wiPropertyName || "System.Title";
                    this.DisplayWI(wi, propertyName, customSettings.wiColorPropertyName, customSettings.color, customSettings.title, customSettings.dateFormat);

                    $("#loadingwidget").hide();
                    $("#content").show();
                    telemetry.track(customSettings.enableTelemetry, "WidgetRendered");

                    $("#wi-title").dotdotdot();
                    $("#wi-desc").dotdotdot();

                    $(".widget").off(); // remove other click event load+reload where configure => prevent multiple windows
                    $(".widget").on("click", function () {
                        WorkItemServices.WorkItemFormNavigationService.getService().then(service => {
                            service.openWorkItem(customSettings.wiId, false); // open the wi dialog
                        });
                    });

                }, (reject) => {
                    $("#loadingwidget").hide();
                    $("#contentError").attr("style", "display:block;margin:10px;");
                    $("#contentError").addClass("error");
                    if (reject.status === "404") {
                        $("#contentError").text("TF401232: Work item Id: " + customSettings.wiId + " does not exist, or you do not have permissions to read it.");
                    } else {
                        $("#contentError").text(reject.message);
                    }
                    logger("LoadWI", "Exception: " + reject.message);
                    telemetry.trackError(customSettings.enableTelemetry, "load-" + String(reject.status || "unknown"));
                });
            } else {
                $("#loadingwidget").hide();
                $("#contentError").attr("style", "display:block;margin:10px;");
                $("#contentError").addClass("error");
                $("#contentError").text("Work Item Id has not been configured.");
                logger("LoadWI", "Exception: Work Item Id has not been configured.");
                telemetry.trackError(customSettings.enableTelemetry, "not-configured");
            }
        } else {
            $title.attr("style", "color:grey");
            $("#content").hide();
            $("#loadingwidget").hide();
            $("#contentError").hide();
            $("#configwidget").show();

            logger("LoadWI", "no settings");
        }

        return this.WidgetHelpers.WidgetStatusHelper.Success();
    }

    private DisplayWI(wi: WorkItemsContracts.WorkItem, fieldname: string, colorfield: string, colorstring: string, titlestring: string, dateFormat: string) {
        logger("DisplayWI", "step 1");

        $("#wi-header").attr("style", "height: " + 30 + "px;");
//        $("#wi-title").attr("style", "height: " + 0 + "px;");
        $("#wi-type").attr("style", "height: " + 10 + "px;");
        $("#updated").attr("style", "height: " + 0 + "px;");
        $("#assignuser").attr("style", "height: " + 0 + "px;");
        $("#statecircle").attr("style", "height: " + 0 + "px;");
        $("#wi-desc").attr("style", "height: calc(100vh - " + 30 + "px); min-height: calc(100vh - " + 30 + "px);");

//        let witype = wi.fields["System.WorkItemType"];
        let witype = wi.fields[colorfield];
        let wititle = wi.fields["System.Title"];

        let stringParts = fieldname.split(".");
        wititle = stringParts.pop();

        wititle = titlestring;

        let color = this.getWorkItemColor(witype);
        let bodyText = "";
        let bodyStyle = "";
        if (colorstring !== "") {
            colorstring = this.resolveColor(colorstring);
            bodyText = this.getTextColor(colorstring);
            bodyStyle = "background-color: " + colorstring + ";" + (bodyText ? " color: " + bodyText + ";" : "");
            color = colorstring;
            logger("DisplayWI", "color prop: " + colorfield + "; value: " + color + "; color: " + colorstring);
        }
        // set on every render so a Color that was cleared doesn't keep its old background
        $("#content").attr("style", bodyStyle);

//        $("#wi-header").attr("style", "border-left-color: " + color + ";");
        let headerText = this.getTextColor(color);
        $("#wi-header").attr("style", "background-color: " + color + ";" + (headerText ? " color: " + headerText + ";" : ""));
//        $("#wi-type").html(witype + " " + wi.id);
        $("#wi-title").text(wititle);

        let desc = wi.fields[fieldname];
        if (desc !== undefined) {
            // desc = this.noHtml(desc);

            // field values are untrusted: keep formatting, remove script, handlers and remote content
            $("#wi-desc").html(sanitizeHtml(this.toDisplayHtml(desc)));
            if (dateFormat !== "") {
                let date = this.toDisplayDate(desc);
                if (date.isValid()) {
                    logger("DisplayWI", "format date: " + date.format(dateFormat));
                    logger("DisplayWI", "check if valid date: " + date.isValid() + "; " + desc);
                    $("#wi-desc").text(date.format(dateFormat));
                }
            }
        } else {
            $("#wi-desc").html("");
        }

        // links and the "Updated by" line have their own colors, so they follow the text color too
        $("#wi-desc a").css("color", bodyText);
        $(".wi-updated").attr("style", bodyText ? "color: " + bodyText + ";" : "");
        $("#updateby").text("Updated by ".concat(wi.fields["System.ChangedBy"]));
        $("#updatedate").text(this.DeltaDate(new Date(wi.fields["System.ChangedDate"])).text);

        let assign = wi.fields["System.AssignedTo"];

        if (assign !== undefined) {
            $("#assignuser").text(assign);
            $("#assignavatar").attr("src", this.getMemberAvatarUrl(assign));
        } else {
            $("#assignuser").text("Unassigned");
            $("#assignavatar").hide();
        }

        let state = wi.fields["System.State"];
        $("#state").text(state);

        let statecolor = this.getStateColor(state);
        let backgroundcolor = statecolor;
        if (state === "Removed") {
            backgroundcolor = "transparent";
        }
        $("#statecircle").attr("style", "border-color:" + statecolor + ";background-color:" + backgroundcolor + "");
    }

    // Azure DevOps stores date-only values as midnight UTC. Showing them in local time moves them back a day
    // for users west of UTC, so midnight UTC values keep their UTC calendar date. Other values use local time.
    private toDisplayDate(value: string): moment.Moment {
        let utc = moment.utc(value);
        if (utc.isValid() && utc.format("HH:mm:ss.SSS") === "00:00:00.000") {
            return utc;
        }
        return moment(value);
    }

    // Plain text keeps its line breaks, which HTML would collapse into spaces. Values that already have
    // HTML tags are returned unchanged for the sanitizer.
    private toDisplayHtml(value: any): string {
        let text = String(value);
        if (/<[a-z][\s\S]*>/i.test(text)) {
            return text;
        }
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
    }

    private isValidDate(date) {
        logger("isValidDate", "step 1");
        return date && Object.prototype.toString.call(date) === "[object Date]" && !isNaN(date);
      }

    private noHtml(txt) {
        logger("noHtml", "step 1");
        let a = txt.indexOf("<");
        let b = txt.indexOf(">");
        let len = txt.length;
        let c = txt.substring(0, a);
        if (b === -1) {
            b = a;
        }
        let d = txt.substring((b + 1), len);
        txt = c + d;
        if (a !== b) {
            txt = this.noHtml(txt);
        }
        return (txt);
    }

    // Amber isn't a CSS color name, so map it to its hex value. Any capitalization works.
    private resolveColor(value: string): string {
        logger("resolveColor", "step 1");
        if (typeof value === "string" && value.trim().toLowerCase() === "amber") {
            return "#FFC000";
        }
        return value;
    }

    // Returns black or white text, whichever reads better on the background. Returns "" when the
    // background isn't a solid color, so the theme text color stays.
    private getTextColor(background: string): string {
        logger("getTextColor", "step 1");
        let probe = document.createElement("div");
        probe.style.color = this.resolveColor(background);
        if (probe.style.color === "") {
            return "";
        }
        document.body.appendChild(probe);
        let parts = (window.getComputedStyle(probe).color || "").match(/[\d.]+/g) || [];
        document.body.removeChild(probe);
        let alpha = parts.length === 4 ? Number(parts[3]) : 1;
        if (parts.length < 3 || alpha < 1) {
            return "";
        }
        let channels = parts.slice(0, 3).map(part => {
            let c = Number(part) / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        let luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
        // black text reads better above this luminance, white text below it
        return luminance > 0.179 ? "#000000" : "#ffffff";
    }

    private getWorkItemColor(workItemType: string): string {
        logger("getWorkItemColor", "step 1");
        let witColor = this.resolveColor(workItemType);
        logger("getWorkItemColor", "result: " + witColor);
        return witColor;
    }

    private getStateColor(state: string): string {
        logger("getStateColor", "step 1");
        let statecolor = "";
        switch (state) {

            case "Approved":
            case "New":
            case "To Do":
            case "Design":
                statecolor = "#b2b2b2";
                break;
            case "In Progress":
            case "Committed":
            case "Open":
            case "Ready":
            case "Active":
            case "In Planning":
                statecolor = "#007acc";
                break;
            case "Done":
            case "Closed":
            case "Inactive":
            case "Completed":
                statecolor = "#393";
                break;
            case "Removed":
                statecolor = "#5688e0";
                break;
            default:
                statecolor = "#b2b2b2";

        }

        return statecolor;
    }

    private DeltaDate(date: Date): IDeltaDateInfo {
        logger("DeltaDate", "step 1");
        let now = Date.now();
        let past = date.getTime();

        let days = Math.floor((now - past) / (1000 * 60 * 60 * 24));

        let result = {
            days: days,
            text: ""
        };

        if (days > 365) {
            let years = Math.floor(days / 365);
            if (years === 1) {
                result.text = `A year ago`;
            } else {
                result.text = `${years} year(s) ago`;
            }

        } else if (days > 30) {
            let months = Math.floor(days / 30);
            if (months === 1) {
                result.text = `A month ago`;
            } else {
                result.text = `${months} month(s) ago`;
            }

        }
        else if (days > 7) {
            result.text = "This month";
        }
        else if (days <= 7 && days > 1) {
            result.text = `${days} days ago`;
        }
        else if (days === 1) {
            result.text = "Yesterday";
        } else {
            result.text = "Today";
        }
        return result;
    }

    private getMemberAvatarUrl(memberIdentity: string): string {
        logger("getMemberAvatarUrl", "step 1");

        let i = memberIdentity.lastIndexOf("<");
        let j = memberIdentity.lastIndexOf(">");
        let uniqueName = $.trim(memberIdentity.substr(i + 1, j - i - 1));

        return VSS.getWebContext().host.uri + "_api/_common/IdentityImage?id=&identifier=" + uniqueName;
    }

    // Load and Reload Methods
    public load(widgetSettings) {
        logger("load", "step 1");
        return this.LoadWI(widgetSettings);
    }
    public reload(widgetSettings) {
        logger("reload", "step 1");
        return this.LoadWI(widgetSettings);
    }
}

VSS.require("TFS/Dashboards/WidgetHelpers", function (WidgetHelpers) {
    logger("", "step 1");
    WidgetHelpers.IncludeWidgetStyles();
    VSS.register("wipropertywidget", () => {
        let widgetProperty = new WidgetWIProperty(WidgetHelpers);
        return widgetProperty;
    });
    VSS.notifyLoadSucceeded();
});

interface IDeltaDateInfo {
    text: string;
    days: number;
}