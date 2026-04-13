const sampleData = {
    "rmsRouteSummaries": [
        {
            "routeId": "16666856-64",
            "routeCode": "CX64",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "a54a529b-c04d-474c-8fc2-44bfb82c2258",
                    "routeId": null,
                    "transporterId": "AP6ZG0T4OHDTB",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "eb7d12df-5349-46cf-ba40-479b775039dc",
                            "plannedStart": 1776024652000,
                            "plannedEnd": 1776025552000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "f52820ae-0117-4c30-8272-96a92ea7989c",
                            "plannedStart": 1776033448000,
                            "plannedEnd": 1776035248000,
                            "plannedSequenceNumber": 95,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "1512226b-342d-4006-8a83-0cb118066592",
                            "plannedStart": 1776041130000,
                            "plannedEnd": 1776042030000,
                            "plannedSequenceNumber": 143,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776040339961,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": null,
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-64",
                            "routeCode": "CX64"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 310,
                        "completedPickUps": 310,
                        "totalDeliveries": 310,
                        "completedDeliveries": 224,
                        "successfulDeliveries": 223,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 620,
                        "unassignedPackages": 0,
                        "completedTasks": 534,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 115,
                        "unassignedStops": 0,
                        "completedStops": 134,
                        "notStartedStops": 54,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 189,
                        "completedLocations": 181,
                        "totalLocations": 252,
                        "completedMultiLocationStops": 38,
                        "totalMultiLocationStops": 51,
                        "routePackageSummary": {
                            "DELIVERED": 223,
                            "REMAINING": 86,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 21,
                    "completedStopsInLastHour": 28,
                    "itineraryStartTime": 1776016358771,
                    "actualRouteDepartureTime": 1776017755980
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 26913,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 20,
                    "packagesImpacted": 39
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 311,
                "completedPickUps": 311,
                "totalDeliveries": 311,
                "completedDeliveries": 225,
                "successfulDeliveries": 223,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 622,
                "unassignedPackages": 2,
                "completedTasks": 536,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 115,
                "unassignedStops": 1,
                "completedStops": 135,
                "notStartedStops": 54,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 190,
                "completedLocations": 182,
                "totalLocations": 253,
                "completedMultiLocationStops": 38,
                "totalMultiLocationStops": 51,
                "routePackageSummary": {
                    "DELIVERED": 223,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 86,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.00436,
                "longitude": -121.776515,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 2
                    },
                    "countByState": {
                        "PAST": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 14.692419715966562,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "AP6ZG0T4OHDTB",
            "preDispatch": false,
            "routeCreationTime": 1776006612,
            "rmsRouteId": "69d50621-01fb-412c-bb04-67bbf43b4c5f",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-57",
            "routeCode": "CX57",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "3847ecbe-c409-470a-b606-78cace0a024d",
                    "routeId": null,
                    "transporterId": "A2JLWPZYNNAXRK",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "4649d1fb-1aee-4a93-80b0-46137b9160b9",
                            "plannedStart": 1776024700000,
                            "plannedEnd": 1776025600000,
                            "plannedSequenceNumber": 41,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "6eda0660-c078-4939-9fb8-f29f5be54524",
                            "plannedStart": 1776034115000,
                            "plannedEnd": 1776035915000,
                            "plannedSequenceNumber": 83,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "f1e70ce5-22a2-4be8-8dd7-22942a52e95e",
                            "plannedStart": 1776041659000,
                            "plannedEnd": 1776042559000,
                            "plannedSequenceNumber": 124,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776040334927,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X84PKA60647",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-57",
                            "routeCode": "CX57"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 288,
                        "completedPickUps": 288,
                        "totalDeliveries": 288,
                        "completedDeliveries": 172,
                        "successfulDeliveries": 170,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 576,
                        "unassignedPackages": 0,
                        "completedTasks": 460,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 141,
                        "unassignedStops": 0,
                        "completedStops": 113,
                        "notStartedStops": 52,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 166,
                        "completedLocations": 147,
                        "totalLocations": 223,
                        "completedMultiLocationStops": 31,
                        "totalMultiLocationStops": 49,
                        "routePackageSummary": {
                            "DELIVERED": 170,
                            "MISSING": 1,
                            "REMAINING": 116,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 18,
                    "completedStopsInLastHour": 22,
                    "itineraryStartTime": 1776015727887,
                    "actualRouteDepartureTime": 1776018559189
                },
                {
                    "itineraryId": "90637e48-ec1d-4e72-a4ca-ec15a7a7341f",
                    "routeId": null,
                    "transporterId": "AB06077WGSV8G",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "ca213ce2-223b-4b34-8705-d4ffea599ead",
                            "plannedStart": 1776030186000,
                            "plannedEnd": 1776031086000,
                            "plannedSequenceNumber": 15,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "a98c5fe5-3ff7-4d0d-a2b9-3cb981d02ee3",
                            "plannedStart": 1776033923000,
                            "plannedEnd": 1776035723000,
                            "plannedSequenceNumber": 31,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "10eec648-c4cb-439b-b382-e40c2b46a684",
                            "plannedStart": 1776038295000,
                            "plannedEnd": 1776039195000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776039337868,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": null,
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-69",
                            "routeCode": "CX69"
                        },
                        {
                            "routeId": "16666856-57",
                            "routeCode": "CX57"
                        },
                        {
                            "routeId": "16666856-60",
                            "routeCode": "CX60"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "COMPLETED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": true,
                    "scheduleEndTime": 1776039385255,
                    "timeRemainingSecs": 18657,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 35,
                        "completedPickUps": 35,
                        "totalDeliveries": 35,
                        "completedDeliveries": 35,
                        "successfulDeliveries": 35,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 70,
                        "unassignedPackages": 0,
                        "completedTasks": 70,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 1,
                        "unassignedStops": 0,
                        "completedStops": 25,
                        "notStartedStops": 0,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 25,
                        "completedLocations": 30,
                        "totalLocations": 30,
                        "completedMultiLocationStops": 3,
                        "totalMultiLocationStops": 5,
                        "routePackageSummary": {
                            "DELIVERED": 35,
                            "REMAINING": 0
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 14,
                    "itineraryStartTime": 1776023171422,
                    "actualRouteDepartureTime": 1776030736275
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 32226,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AT_RISK": {
                    "stopsImpacted": 10,
                    "packagesImpacted": 19
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 323,
                "completedPickUps": 323,
                "totalDeliveries": 323,
                "completedDeliveries": 207,
                "successfulDeliveries": 205,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 646,
                "unassignedPackages": 0,
                "completedTasks": 530,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 141,
                "unassignedStops": 0,
                "completedStops": 131,
                "notStartedStops": 52,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 3,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 176,
                "totalLocations": 250,
                "completedMultiLocationStops": 34,
                "totalMultiLocationStops": 52,
                "routePackageSummary": {
                    "DELIVERED": 205,
                    "MISSING": 1,
                    "REMAINING": 116,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.005484,
                "longitude": -121.902983,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AT_RISK",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 45
                    },
                    "countByState": {
                        "PAST": 5,
                        "FUTURE": 40
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 27.615193289075833,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A2JLWPZYNNAXRK",
            "preDispatch": false,
            "routeCreationTime": 1776006614,
            "rmsRouteId": "896ab3e8-37c7-4624-8f58-0e57dc1ad795",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-60",
            "routeCode": "CX60",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "90637e48-ec1d-4e72-a4ca-ec15a7a7341f",
                    "routeId": null,
                    "transporterId": "AB06077WGSV8G",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "ca213ce2-223b-4b34-8705-d4ffea599ead",
                            "plannedStart": 1776030186000,
                            "plannedEnd": 1776031086000,
                            "plannedSequenceNumber": 15,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "a98c5fe5-3ff7-4d0d-a2b9-3cb981d02ee3",
                            "plannedStart": 1776033923000,
                            "plannedEnd": 1776035723000,
                            "plannedSequenceNumber": 31,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "10eec648-c4cb-439b-b382-e40c2b46a684",
                            "plannedStart": 1776038295000,
                            "plannedEnd": 1776039195000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776039337868,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": null,
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-69",
                            "routeCode": "CX69"
                        },
                        {
                            "routeId": "16666856-57",
                            "routeCode": "CX57"
                        },
                        {
                            "routeId": "16666856-60",
                            "routeCode": "CX60"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "COMPLETED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": true,
                    "scheduleEndTime": 1776039385255,
                    "timeRemainingSecs": 18657,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 28,
                        "completedPickUps": 28,
                        "totalDeliveries": 28,
                        "completedDeliveries": 28,
                        "successfulDeliveries": 27,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 56,
                        "unassignedPackages": 0,
                        "completedTasks": 56,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 1,
                        "unassignedStops": 0,
                        "completedStops": 20,
                        "notStartedStops": 0,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 20,
                        "completedLocations": 26,
                        "totalLocations": 26,
                        "completedMultiLocationStops": 5,
                        "totalMultiLocationStops": 5,
                        "routePackageSummary": {
                            "DELIVERED": 27,
                            "REATTEMPTABLE": 1,
                            "REMAINING": 0
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 14,
                    "itineraryStartTime": 1776023171422,
                    "actualRouteDepartureTime": 1776035098401
                },
                {
                    "itineraryId": "ffc4f76d-e460-4ed7-b6fc-726c5cfb394b",
                    "routeId": null,
                    "transporterId": "A1LS4EWB49P78R",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "4e86156c-2503-47e7-a036-a5ae0d8ac59d",
                            "plannedStart": 1776025830000,
                            "plannedEnd": 1776026730000,
                            "plannedSequenceNumber": 43,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "4245fe14-2df2-4b95-a799-62d19e5ea0f1",
                            "plannedStart": 1776034355000,
                            "plannedEnd": 1776036155000,
                            "plannedSequenceNumber": 86,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "8f0935b4-4eeb-4b62-871b-27d3f22dfb8e",
                            "plannedStart": 1776044593000,
                            "plannedEnd": 1776045493000,
                            "plannedSequenceNumber": 129,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776038112282,
                    "lastVehicleMovementTime": 1776038478289,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X87MKA54465",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-60",
                            "routeCode": "CX60"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 339,
                        "completedPickUps": 339,
                        "totalDeliveries": 339,
                        "completedDeliveries": 227,
                        "successfulDeliveries": 224,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 678,
                        "unassignedPackages": 0,
                        "completedTasks": 566,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 109,
                        "unassignedStops": 0,
                        "completedStops": 112,
                        "notStartedStops": 59,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 172,
                        "completedLocations": 172,
                        "totalLocations": 256,
                        "completedMultiLocationStops": 47,
                        "totalMultiLocationStops": 66,
                        "routePackageSummary": {
                            "DELIVERED": 224,
                            "MISSING": 1,
                            "UNDELIVERABLE": 1,
                            "REMAINING": 112,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 17,
                    "completedStopsInLastHour": 13,
                    "itineraryStartTime": 1776015564432,
                    "actualRouteDepartureTime": 1776017000476
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 30647,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 19,
                    "packagesImpacted": 30
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 368,
                "completedPickUps": 368,
                "totalDeliveries": 368,
                "completedDeliveries": 256,
                "successfulDeliveries": 251,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 736,
                "unassignedPackages": 2,
                "completedTasks": 624,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 109,
                "unassignedStops": 0,
                "completedStops": 128,
                "notStartedStops": 59,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 2,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 190,
                "completedLocations": 198,
                "totalLocations": 280,
                "completedMultiLocationStops": 52,
                "totalMultiLocationStops": 71,
                "routePackageSummary": {
                    "DELIVERED": 251,
                    "MISSING": 1,
                    "UNDELIVERABLE": 2,
                    "REATTEMPTABLE": 1,
                    "REMAINING": 112,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.01051,
                "longitude": -121.885853,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 64
                    },
                    "countByState": {
                        "PAST": 52,
                        "FUTURE": 12
                    },
                    "summaryDetail": null
                },
                "ONE_CLICK_EXIT": {
                    "iconType": "ONE_CLICK_EXIT",
                    "countByStatus": {
                        "PENDING": 11
                    },
                    "countByState": {
                        "PAST": 11
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 13.335914091764815,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1LS4EWB49P78R",
            "preDispatch": false,
            "routeCreationTime": 1776006615,
            "rmsRouteId": "132f5c2e-5ba7-4656-aadf-14c9ff8cd0d2",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-65",
            "routeCode": "CX65",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "e1341509-2474-4d21-9ebc-d1eb4af50996",
                    "routeId": null,
                    "transporterId": "A7I3A1KHUWAFO",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "09229580-f3f9-4f7b-9706-a4982def6fd5",
                            "plannedStart": 1776029457000,
                            "plannedEnd": 1776030357000,
                            "plannedSequenceNumber": 39,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.d4a646efdd0e383cae39fdd367a99650267f112e02e8dbaa809882acbf157cc4",
                            "plannedStart": 1776032324973,
                            "plannedEnd": 1776034124973,
                            "plannedSequenceNumber": 55,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "67c3c6c6-1d4a-4136-9e90-bc567880c78d",
                            "plannedStart": 1776045231000,
                            "plannedEnd": 1776046131000,
                            "plannedSequenceNumber": 118,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.da271626296a56a8e658bcc9f2ec4556bf3e4ec68e1147bff1b2745d6bf796e5",
                            "plannedStart": 1776054824973,
                            "plannedEnd": 1776056624973,
                            "plannedSequenceNumber": 158,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.35c96209fc8efd2004eb9faa949437af5e60ff0362ed802ad1278a13d79cfd7a",
                            "breakId": "flex.wt.break.v1.84ef90982425e5f861556110ecffebc932009e5a6cfeff816b073471a7820d46",
                            "timeStampOn": 1776025459503,
                            "timeStampOff": 1776025730275,
                            "sequenceNumber": 24,
                            "state": "OFF",
                            "type": "REST"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.5e737fbcbe318821358cb6cb082f8bd1aec9d4b019cabc786c17800f0cdc6708",
                            "breakId": "flex.wt.break.v1.53DBF62F-BA00-4599-AF42-1413D39F5C12",
                            "timeStampOn": 1776037875646,
                            "timeStampOff": 1776038453398,
                            "sequenceNumber": 69,
                            "state": "OFF",
                            "type": "REST"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.a6b40faa9276963bb0f3dfd9e3bb77454d9e60704a2ccc6702e26b25651a6af0",
                            "breakId": "flex.wt.break.v1.d4a646efdd0e383cae39fdd367a99650267f112e02e8dbaa809882acbf157cc4",
                            "timeStampOn": 1776031264005,
                            "timeStampOff": 1776033071818,
                            "sequenceNumber": 55,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776037875.646000000,
                    "lastDriverEventTime": 1776040226930,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X84NKA02793",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-65",
                            "routeCode": "CX65"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2656,
                    "routeDeliveryProgress": {
                        "totalPickUps": 271,
                        "completedPickUps": 271,
                        "totalDeliveries": 271,
                        "completedDeliveries": 132,
                        "successfulDeliveries": 131,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 542,
                        "unassignedPackages": 0,
                        "completedTasks": 403,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 71,
                        "unassignedStops": 0,
                        "completedStops": 79,
                        "notStartedStops": 79,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 158,
                        "completedLocations": 99,
                        "totalLocations": 206,
                        "completedMultiLocationStops": 18,
                        "totalMultiLocationStops": 38,
                        "routePackageSummary": {
                            "DELIVERED": 131,
                            "REMAINING": 139,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 12,
                    "completedStopsInLastHour": 11,
                    "itineraryStartTime": 1776015224978,
                    "actualRouteDepartureTime": 1776017671986
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 30708,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 7,
                    "packagesImpacted": 15
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 272,
                "completedPickUps": 272,
                "totalDeliveries": 272,
                "completedDeliveries": 133,
                "successfulDeliveries": 131,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 544,
                "unassignedPackages": 2,
                "completedTasks": 405,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 71,
                "unassignedStops": 0,
                "completedStops": 78,
                "notStartedStops": 79,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 158,
                "completedLocations": 100,
                "totalLocations": 207,
                "completedMultiLocationStops": 18,
                "totalMultiLocationStops": 38,
                "routePackageSummary": {
                    "DELIVERED": 131,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 139,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.901097,
                "longitude": -121.868168,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 7.392678256470672,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A7I3A1KHUWAFO",
            "preDispatch": false,
            "routeCreationTime": 1776006626,
            "rmsRouteId": "4b5a211c-03d6-45c1-83d6-371a90a68246",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-59",
            "routeCode": "CX59",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "d851fc26-2864-4e9b-9eb3-ee3dcf120692",
                    "routeId": null,
                    "transporterId": "A2RX2JF9ME6N83",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "197f52f5-2cbd-40b2-8fc1-7e658f758b43",
                            "plannedStart": 1776025358000,
                            "plannedEnd": 1776026258000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.eed3d75fa8a648168f09be8afc45b860b4a7ec2874bf0b5486ef5fd8ded6477c",
                            "plannedStart": 1776032490681,
                            "plannedEnd": 1776034290681,
                            "plannedSequenceNumber": 95,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "86c87ec7-1b7c-4539-82dd-dfdf9d1a2c0c",
                            "plannedStart": 1776040632000,
                            "plannedEnd": 1776041532000,
                            "plannedSequenceNumber": 141,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.91fec17b57f788dbbe35e8ef6b000e6fa57738adb6a2330320d0887831ada7e4",
                            "plannedStart": 1776054990681,
                            "plannedEnd": 1776056790681,
                            "plannedSequenceNumber": 189,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.9dba66a81e7db4c65e084bc1737031f557e1b69ec02917a861d12e41df5e9713",
                            "breakId": "flex.wt.break.v1.eed3d75fa8a648168f09be8afc45b860b4a7ec2874bf0b5486ef5fd8ded6477c",
                            "timeStampOn": 1776031443501,
                            "timeStampOff": 1776033245847,
                            "sequenceNumber": 94,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031443.501000000,
                    "lastDriverEventTime": 1776040354044,
                    "lastVehicleMovementTime": 1776039701189,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTYR3XM1KKB33604",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-59",
                            "routeCode": "CX59"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1802,
                    "routeDeliveryProgress": {
                        "totalPickUps": 308,
                        "completedPickUps": 308,
                        "totalDeliveries": 308,
                        "completedDeliveries": 226,
                        "successfulDeliveries": 224,
                        "onRoadPickups": 1,
                        "completedOnRoadPickups": 1,
                        "totalTasks": 616,
                        "unassignedPackages": 0,
                        "completedTasks": 534,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 112,
                        "unassignedStops": 0,
                        "completedStops": 137,
                        "notStartedStops": 49,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 1,
                        "totalTimeWindowedStops": 2,
                        "totalStops": 187,
                        "completedLocations": 187,
                        "totalLocations": 255,
                        "completedMultiLocationStops": 40,
                        "totalMultiLocationStops": 54,
                        "routePackageSummary": {
                            "DELIVERED": 224,
                            "REMAINING": 82,
                            "PICKUP_FAILED": 2
                        }
                    },
                    "stopCompletionRate": 21,
                    "completedStopsInLastHour": 24,
                    "itineraryStartTime": 1776015390687,
                    "actualRouteDepartureTime": 1776017290170
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 26148,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 25,
                    "packagesImpacted": 45
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 308,
                "completedPickUps": 308,
                "totalDeliveries": 308,
                "completedDeliveries": 226,
                "successfulDeliveries": 224,
                "onRoadPickups": 1,
                "completedOnRoadPickups": 1,
                "totalTasks": 616,
                "unassignedPackages": 0,
                "completedTasks": 534,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 112,
                "unassignedStops": 0,
                "completedStops": 137,
                "notStartedStops": 49,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 1,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 187,
                "totalLocations": 255,
                "completedMultiLocationStops": 40,
                "totalMultiLocationStops": 54,
                "routePackageSummary": {
                    "DELIVERED": 224,
                    "REMAINING": 82,
                    "PICKUP_FAILED": 2
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.997621,
                "longitude": -121.875376,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 3
                    },
                    "countByState": {
                        "PAST": 1,
                        "FUTURE": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 1,
                "completedCustomerReturnStops": 1
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 1,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 5.278551850420235,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [
                {
                    "windowStartTime": 1775977200000,
                    "windowEndTime": 1776049200000,
                    "count": 1
                }
            ],
            "transporterIdFromRms": "A2RX2JF9ME6N83",
            "preDispatch": false,
            "routeCreationTime": 1776006614,
            "rmsRouteId": "ed0994a8-5b23-425e-814c-cfb69c24ba95",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-46",
            "routeCode": "CX46",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "732e17d8-7fb4-4ee9-8212-fe415e31c21a",
                    "routeId": null,
                    "transporterId": "A1CXOF6XEGABI0",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "a6e8e10e-49c9-4254-890f-012a21905967",
                            "plannedStart": 1776024299000,
                            "plannedEnd": 1776025199000,
                            "plannedSequenceNumber": 46,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.3674ea9af4f56fb6e12d9bc68a029380f3312550013fade518d3d9bc29198bb0",
                            "plannedStart": 1776032470927,
                            "plannedEnd": 1776034270927,
                            "plannedSequenceNumber": 97,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "df7256b5-9381-48c6-83da-b09711d7625f",
                            "plannedStart": 1776039353000,
                            "plannedEnd": 1776040253000,
                            "plannedSequenceNumber": 138,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.ac6ef7164cb238db95cd95a1f59c9b5b67b5ebeeb996f2f26280fbc256315749",
                            "plannedStart": 1776054970927,
                            "plannedEnd": 1776056770927,
                            "plannedSequenceNumber": 185,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.dc905b66567cfd8dd999cd4214b85999981f3959599507661d7cb0cc6f5ad2b8",
                            "breakId": "flex.wt.break.v1.3674ea9af4f56fb6e12d9bc68a029380f3312550013fade518d3d9bc29198bb0",
                            "timeStampOn": 1776025753456,
                            "timeStampOff": 1776027611932,
                            "sequenceNumber": 54,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776025753.456000000,
                    "lastDriverEventTime": 1776040358199,
                    "lastVehicleMovementTime": 1776040320391,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X82MKA54437",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-46",
                            "routeCode": "CX46"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1858,
                    "routeDeliveryProgress": {
                        "totalPickUps": 305,
                        "completedPickUps": 305,
                        "totalDeliveries": 305,
                        "completedDeliveries": 224,
                        "successfulDeliveries": 224,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 610,
                        "unassignedPackages": 0,
                        "completedTasks": 529,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 115,
                        "unassignedStops": 0,
                        "completedStops": 135,
                        "notStartedStops": 49,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 184,
                        "completedLocations": 175,
                        "totalLocations": 246,
                        "completedMultiLocationStops": 36,
                        "totalMultiLocationStops": 54,
                        "routePackageSummary": {
                            "DELIVERED": 224,
                            "REMAINING": 81
                        }
                    },
                    "stopCompletionRate": 21,
                    "completedStopsInLastHour": 20,
                    "itineraryStartTime": 1776015370933,
                    "actualRouteDepartureTime": 1776017339887
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 25177,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 20,
                    "packagesImpacted": 33
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 305,
                "completedPickUps": 305,
                "totalDeliveries": 305,
                "completedDeliveries": 224,
                "successfulDeliveries": 224,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 610,
                "unassignedPackages": 0,
                "completedTasks": 529,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 115,
                "unassignedStops": 0,
                "completedStops": 135,
                "notStartedStops": 49,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 184,
                "completedLocations": 175,
                "totalLocations": 246,
                "completedMultiLocationStops": 36,
                "totalMultiLocationStops": 54,
                "routePackageSummary": {
                    "DELIVERED": 224,
                    "REMAINING": 81
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.9849368,
                "longitude": -121.8245456,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 1
                    },
                    "countByState": {
                        "PAST": 1
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 6.364853752941216,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1CXOF6XEGABI0",
            "preDispatch": false,
            "routeCreationTime": 1776006616,
            "rmsRouteId": "1c4c9c8b-9469-497c-a340-02091cb44f07",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-63",
            "routeCode": "CX63",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "9ff3e658-3037-413e-b2dc-41b9a7aab73f",
                    "routeId": null,
                    "transporterId": "A1NF16IEME1QL9",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "1adca610-0ec4-4b46-ae07-04067933cb2b",
                            "plannedStart": 1776025263000,
                            "plannedEnd": 1776026163000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.d93330795d53ca077181c570721972c6e194cbcee349943739d55b928a9e366b",
                            "plannedStart": 1776032785874,
                            "plannedEnd": 1776034585874,
                            "plannedSequenceNumber": 91,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "7625c14f-f3dc-446c-bbda-e53b20fd86d5",
                            "plannedStart": 1776043088000,
                            "plannedEnd": 1776043988000,
                            "plannedSequenceNumber": 142,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.1152f0e469e35f11548ee12ce5b39d7bb3398d7076ca2017359ded6c3286bfae",
                            "plannedStart": 1776055285874,
                            "plannedEnd": 1776057085874,
                            "plannedSequenceNumber": 190,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.837b6f155a147e27dd3f0ad15e3490e1cc1f45e66b368f3fb6cc0c2eb32ac53f",
                            "breakId": "flex.wt.break.v1.d93330795d53ca077181c570721972c6e194cbcee349943739d55b928a9e366b",
                            "timeStampOn": 1776032203245,
                            "timeStampOff": 1776034012305,
                            "sequenceNumber": 95,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776032203.245000000,
                    "lastDriverEventTime": 1776040381847,
                    "lastVehicleMovementTime": 1776040012911,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X80MKA54419",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-63",
                            "routeCode": "CX63"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1809,
                    "routeDeliveryProgress": {
                        "totalPickUps": 320,
                        "completedPickUps": 320,
                        "totalDeliveries": 320,
                        "completedDeliveries": 244,
                        "successfulDeliveries": 243,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 640,
                        "unassignedPackages": 0,
                        "completedTasks": 564,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 107,
                        "unassignedStops": 0,
                        "completedStops": 145,
                        "notStartedStops": 43,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 189,
                        "completedLocations": 195,
                        "totalLocations": 252,
                        "completedMultiLocationStops": 37,
                        "totalMultiLocationStops": 48,
                        "routePackageSummary": {
                            "DELIVERED": 243,
                            "REMAINING": 76,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 24,
                    "completedStopsInLastHour": 30,
                    "itineraryStartTime": 1776015685878,
                    "actualRouteDepartureTime": 1776018552158
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 25508,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 38,
                    "packagesImpacted": 57
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 321,
                "completedPickUps": 321,
                "totalDeliveries": 321,
                "completedDeliveries": 244,
                "successfulDeliveries": 243,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 642,
                "unassignedPackages": 0,
                "completedTasks": 565,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 107,
                "unassignedStops": 0,
                "completedStops": 145,
                "notStartedStops": 43,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 189,
                "completedLocations": 195,
                "totalLocations": 253,
                "completedMultiLocationStops": 37,
                "totalMultiLocationStops": 48,
                "routePackageSummary": {
                    "DELIVERED": 243,
                    "REMAINING": 77,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.9943616,
                "longitude": -121.785209,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 8
                    },
                    "countByState": {
                        "PAST": 8
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 9.331291469916039,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1NF16IEME1QL9",
            "preDispatch": false,
            "routeCreationTime": 1776006624,
            "rmsRouteId": "f2b9fe12-beca-4523-8ddb-0544e006a8c3",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-51",
            "routeCode": "CX51",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "55408627-089b-488b-ad3d-f0f9e8bef69a",
                    "routeId": null,
                    "transporterId": "ALR5H070EUJ55",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "c755e8fa-b9b5-48cd-bd16-5da7db7e3d02",
                            "plannedStart": 1776025644000,
                            "plannedEnd": 1776026544000,
                            "plannedSequenceNumber": 45,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.06c3cdf85b9b37bb0022eef57ffeee0e8f92fa45e63fcc7fcb1d9717124b0aaf",
                            "plannedStart": 1776032442085,
                            "plannedEnd": 1776034242085,
                            "plannedSequenceNumber": 81,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "069f6b43-4824-48de-9111-6747fd9dc9bc",
                            "plannedStart": 1776041638000,
                            "plannedEnd": 1776042538000,
                            "plannedSequenceNumber": 135,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.bf82b8c64cf9cbc9e263c30bceb47d50ee63139f0eb5f0d4e02c2d0893220632",
                            "plannedStart": 1776054942085,
                            "plannedEnd": 1776056742085,
                            "plannedSequenceNumber": 180,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.b45694c8d8139131f32767e019ff77c1717754ebf0d4556fa303ed75be60bcca",
                            "breakId": "flex.wt.break.v1.06c3cdf85b9b37bb0022eef57ffeee0e8f92fa45e63fcc7fcb1d9717124b0aaf",
                            "timeStampOn": 1776031742142,
                            "timeStampOff": 1776033557873,
                            "sequenceNumber": 98,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031742.142000000,
                    "lastDriverEventTime": 1776040283962,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X87PKA60383",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-51",
                            "routeCode": "CX51"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1815,
                    "routeDeliveryProgress": {
                        "totalPickUps": 308,
                        "completedPickUps": 308,
                        "totalDeliveries": 308,
                        "completedDeliveries": 250,
                        "successfulDeliveries": 249,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 616,
                        "unassignedPackages": 0,
                        "completedTasks": 558,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 109,
                        "unassignedStops": 0,
                        "completedStops": 150,
                        "notStartedStops": 30,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 180,
                        "completedLocations": 212,
                        "totalLocations": 258,
                        "completedMultiLocationStops": 51,
                        "totalMultiLocationStops": 63,
                        "routePackageSummary": {
                            "DELIVERED": 249,
                            "REMAINING": 58,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 23,
                    "completedStopsInLastHour": 26,
                    "itineraryStartTime": 1776015342089,
                    "actualRouteDepartureTime": 1776017815143
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27081,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 42,
                    "packagesImpacted": 75
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 309,
                "completedPickUps": 309,
                "totalDeliveries": 309,
                "completedDeliveries": 251,
                "successfulDeliveries": 249,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 618,
                "unassignedPackages": 2,
                "completedTasks": 560,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 109,
                "unassignedStops": 1,
                "completedStops": 151,
                "notStartedStops": 30,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 181,
                "completedLocations": 213,
                "totalLocations": 259,
                "completedMultiLocationStops": 51,
                "totalMultiLocationStops": 63,
                "routePackageSummary": {
                    "DELIVERED": 249,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 58,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.021984,
                "longitude": -121.886804,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 1
                    },
                    "countByState": {
                        "PAST": 1
                    },
                    "summaryDetail": null
                },
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 2
                    },
                    "countByState": {
                        "PAST": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 2.8259415011764855,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "ALR5H070EUJ55",
            "preDispatch": false,
            "routeCreationTime": 1776006615,
            "rmsRouteId": "8b8422be-7948-4e31-9715-a41ac277afe4",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-61",
            "routeCode": "CX61",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776019200000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "330f6509-235d-46c2-b560-31844979521b",
                    "routeId": null,
                    "transporterId": "A3LEMQU65KHSAE",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "8942ff73-3d5a-4a2f-8b9b-517ac269e9b7",
                            "plannedStart": 1776025744000,
                            "plannedEnd": 1776026644000,
                            "plannedSequenceNumber": 45,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.d035db8e3f3fc75d04e8682d1722408d1944c43403c51a1cac91bad4d29e521d",
                            "plannedStart": 1776032768035,
                            "plannedEnd": 1776034568035,
                            "plannedSequenceNumber": 95,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "dc113062-cfaa-4ac8-a938-9df6b2f31db7",
                            "plannedStart": 1776043048000,
                            "plannedEnd": 1776043948000,
                            "plannedSequenceNumber": 137,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.9aee0d6fe935d8fc043ead55d0f846a69a544c7809088d368a6ffff2afe72274",
                            "plannedStart": 1776055268035,
                            "plannedEnd": 1776057068035,
                            "plannedSequenceNumber": 183,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.87d870235c0ea6d334b871af334f154a7236396b08af57882340befcc84c7018",
                            "breakId": "flex.wt.break.v1.d035db8e3f3fc75d04e8682d1722408d1944c43403c51a1cac91bad4d29e521d",
                            "timeStampOn": 1776029254526,
                            "timeStampOff": 1776031055888,
                            "sequenceNumber": 89,
                            "state": "OFF",
                            "type": "MEAL"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.bb9757b521800ef1f205dba7d885e4259dda94ff45ba838650bd22d9d990cd77",
                            "breakId": "flex.wt.break.v1.14bc20c13a4931b3d814a3c6e72a3cecf2e257b65c01ce0a4d26490d60bce994",
                            "timeStampOn": 1776031059191,
                            "timeStampOff": 1776031966658,
                            "sequenceNumber": 89,
                            "state": "OFF",
                            "type": "REST"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031059.191000000,
                    "lastDriverEventTime": 1776040361217,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X89PKB55138",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-61",
                            "routeCode": "CX61"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776054000000,
                    "timeRemainingSecs": 13557,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2708,
                    "routeDeliveryProgress": {
                        "totalPickUps": 307,
                        "completedPickUps": 307,
                        "totalDeliveries": 307,
                        "completedDeliveries": 232,
                        "successfulDeliveries": 231,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 614,
                        "unassignedPackages": 0,
                        "completedTasks": 539,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 113,
                        "unassignedStops": 0,
                        "completedStops": 144,
                        "notStartedStops": 43,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 2,
                        "totalTimeWindowedStops": 2,
                        "totalStops": 188,
                        "completedLocations": 192,
                        "totalLocations": 251,
                        "completedMultiLocationStops": 40,
                        "totalMultiLocationStops": 53,
                        "routePackageSummary": {
                            "DELIVERED": 231,
                            "REMAINING": 75,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 21,
                    "completedStopsInLastHour": 25,
                    "itineraryStartTime": 1776015668043,
                    "actualRouteDepartureTime": 1776017135985
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 26299,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 31,
                    "packagesImpacted": 54
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 307,
                "completedPickUps": 307,
                "totalDeliveries": 307,
                "completedDeliveries": 232,
                "successfulDeliveries": 231,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 614,
                "unassignedPackages": 0,
                "completedTasks": 539,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 113,
                "unassignedStops": 0,
                "completedStops": 144,
                "notStartedStops": 43,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 2,
                "totalTimeWindowedStops": 0,
                "totalStops": 188,
                "completedLocations": 192,
                "totalLocations": 251,
                "completedMultiLocationStops": 40,
                "totalMultiLocationStops": 53,
                "routePackageSummary": {
                    "DELIVERED": 231,
                    "REMAINING": 75,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.999603,
                "longitude": -121.824305,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 20
                    },
                    "countByState": {
                        "PAST": 20
                    },
                    "summaryDetail": null
                },
                "ONE_CLICK_EXIT": {
                    "iconType": "ONE_CLICK_EXIT",
                    "countByStatus": {
                        "PENDING": 3
                    },
                    "countByState": {
                        "PAST": 3
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 1,
                "actionedScheduledDeliveryStops": 1
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 11.6066543656808,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [
                {
                    "windowStartTime": 1775916000000,
                    "windowEndTime": 1775930400000,
                    "count": 1
                }
            ],
            "transporterIdFromRms": "A3LEMQU65KHSAE",
            "preDispatch": false,
            "routeCreationTime": 1776006624,
            "rmsRouteId": "9f5750c5-91d5-4fe4-9962-07b698cbba68",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-56",
            "routeCode": "CX56",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "660a2762-a4e2-4d54-9f73-111c6131229b",
                    "routeId": null,
                    "transporterId": "A2TBJQ2EO8483T",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "c3264f32-ced0-429d-8e7d-2bcbbeed54ed",
                            "plannedStart": 1776024922000,
                            "plannedEnd": 1776025822000,
                            "plannedSequenceNumber": 46,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.a1525914e9a06b09f6398cec78a7d85e003f02b1f9611e3aa2586e356b40f4fc",
                            "plannedStart": 1776032318791,
                            "plannedEnd": 1776034118791,
                            "plannedSequenceNumber": 92,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "a239c219-7ce7-4ae9-a760-4271e1b4e8ec",
                            "plannedStart": 1776040500000,
                            "plannedEnd": 1776041400000,
                            "plannedSequenceNumber": 140,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.56650a871122030574dcf2c4242e413381eed3bf4f0807add7ca7f3047391daf",
                            "plannedStart": 1776054818791,
                            "plannedEnd": 1776056618791,
                            "plannedSequenceNumber": 187,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.53a07675838f5f43ef207fe02f018e67641d4ba00c2397d6bbdfee9ca11710eb",
                            "breakId": "flex.wt.break.v1.a1525914e9a06b09f6398cec78a7d85e003f02b1f9611e3aa2586e356b40f4fc",
                            "timeStampOn": 1776028941920,
                            "timeStampOff": 1776030776135,
                            "sequenceNumber": 188,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776028941.920000000,
                    "lastDriverEventTime": 1776040362235,
                    "lastVehicleMovementTime": 1776039706900,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X8XMKA54590",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-56",
                            "routeCode": "CX56"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1834,
                    "routeDeliveryProgress": {
                        "totalPickUps": 285,
                        "completedPickUps": 285,
                        "totalDeliveries": 285,
                        "completedDeliveries": 240,
                        "successfulDeliveries": 240,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 570,
                        "unassignedPackages": 0,
                        "completedTasks": 525,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 115,
                        "unassignedStops": 0,
                        "completedStops": 162,
                        "notStartedStops": 24,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 187,
                        "completedLocations": 208,
                        "totalLocations": 244,
                        "completedMultiLocationStops": 44,
                        "totalMultiLocationStops": 55,
                        "routePackageSummary": {
                            "DELIVERED": 240,
                            "REMAINING": 45
                        }
                    },
                    "stopCompletionRate": 25,
                    "completedStopsInLastHour": 36,
                    "itineraryStartTime": 1776015218796,
                    "actualRouteDepartureTime": 1776017426292
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 25792,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 47,
                    "packagesImpacted": 66
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 286,
                "completedPickUps": 286,
                "totalDeliveries": 286,
                "completedDeliveries": 241,
                "successfulDeliveries": 240,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 572,
                "unassignedPackages": 2,
                "completedTasks": 527,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 115,
                "unassignedStops": 0,
                "completedStops": 162,
                "notStartedStops": 24,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 209,
                "totalLocations": 245,
                "completedMultiLocationStops": 44,
                "totalMultiLocationStops": 55,
                "routePackageSummary": {
                    "DELIVERED": 240,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 45
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.0097138,
                "longitude": -121.8941242,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 5.149442421176529,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A2TBJQ2EO8483T",
            "preDispatch": false,
            "routeCreationTime": 1776006614,
            "rmsRouteId": "f6822dd1-d255-431c-8afd-3422dfc48768",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-66",
            "routeCode": "CX66",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776019200000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "eb2d0529-9e2b-474d-ab18-623a5b10da22",
                    "routeId": null,
                    "transporterId": "A1B9PIDLCF2H9K",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "411e12a6-ee7b-42e8-a626-742cc8a99132",
                            "plannedStart": 1776027214000,
                            "plannedEnd": 1776028114000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.952bace3f4b64803d729693cf1608d7265393d61b972d04a082fb56a186d1f6c",
                            "plannedStart": 1776032687063,
                            "plannedEnd": 1776034487063,
                            "plannedSequenceNumber": 85,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "b22b8f90-5c40-437d-a01d-c20d317efc05",
                            "plannedStart": 1776040890000,
                            "plannedEnd": 1776041790000,
                            "plannedSequenceNumber": 141,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.3f13fb429f650c68e91c6ebab59380af78f3f13d012cc4ff7baa5a9c8f45fd2a",
                            "plannedStart": 1776055187063,
                            "plannedEnd": 1776056987063,
                            "plannedSequenceNumber": 189,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.d24329780c6dce162fb92c6bf29440919bd70e290bd0a1a1a8b93ba1de6f33ae",
                            "breakId": "flex.wt.break.v1.952bace3f4b64803d729693cf1608d7265393d61b972d04a082fb56a186d1f6c",
                            "timeStampOn": 1776031505926,
                            "timeStampOff": 1776033306908,
                            "sequenceNumber": 91,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031505.926000000,
                    "lastDriverEventTime": 1776040241376,
                    "lastVehicleMovementTime": 1776039705823,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X80MKA54534",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-66",
                            "routeCode": "CX66"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776054000000,
                    "timeRemainingSecs": 13557,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1800,
                    "routeDeliveryProgress": {
                        "totalPickUps": 320,
                        "completedPickUps": 320,
                        "totalDeliveries": 320,
                        "completedDeliveries": 248,
                        "successfulDeliveries": 248,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 640,
                        "unassignedPackages": 0,
                        "completedTasks": 568,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 121,
                        "unassignedStops": 0,
                        "completedStops": 144,
                        "notStartedStops": 42,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 187,
                        "completedLocations": 185,
                        "totalLocations": 241,
                        "completedMultiLocationStops": 36,
                        "totalMultiLocationStops": 45,
                        "routePackageSummary": {
                            "DELIVERED": 248,
                            "REMAINING": 72
                        }
                    },
                    "stopCompletionRate": 22,
                    "completedStopsInLastHour": 31,
                    "itineraryStartTime": 1776015587072,
                    "actualRouteDepartureTime": 1776017242632
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 26107,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 23,
                    "packagesImpacted": 40
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 321,
                "completedPickUps": 321,
                "totalDeliveries": 321,
                "completedDeliveries": 249,
                "successfulDeliveries": 248,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 642,
                "unassignedPackages": 2,
                "completedTasks": 570,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 121,
                "unassignedStops": 0,
                "completedStops": 144,
                "notStartedStops": 42,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 185,
                "totalLocations": 241,
                "completedMultiLocationStops": 36,
                "totalMultiLocationStops": 45,
                "routePackageSummary": {
                    "DELIVERED": 248,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 72
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.9226271,
                "longitude": -121.9142,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 2
                    },
                    "countByState": {
                        "PAST": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 4.912413171764772,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1B9PIDLCF2H9K",
            "preDispatch": false,
            "routeCreationTime": 1776006626,
            "rmsRouteId": "41de8a0f-2c8a-4b56-90ba-d2a4ae9d7846",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-67",
            "routeCode": "CX67",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "5c3c51e2-9c3a-45f5-9c73-fe510391a1af",
                    "routeId": null,
                    "transporterId": "AMZXF6V3XY1WV",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "4a988b4a-2062-443d-9744-6369f210de42",
                            "plannedStart": 1776026066000,
                            "plannedEnd": 1776026966000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.781e59b5838aef05cd9863d745cee7971246710ef2ac32d68b7b3e15aebdd09a",
                            "plannedStart": 1776032803768,
                            "plannedEnd": 1776034603768,
                            "plannedSequenceNumber": 84,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "581912cf-aadb-4647-b18e-525668f63964",
                            "plannedStart": 1776042245000,
                            "plannedEnd": 1776043145000,
                            "plannedSequenceNumber": 141,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.8d0a82f5edb3b5b099b42b579cc9ffa83bc54a87562aa31986ac82e2b3e34e48",
                            "plannedStart": 1776055303768,
                            "plannedEnd": 1776057103768,
                            "plannedSequenceNumber": 189,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.07976a03aa2ec9721b5c809b2613c0f40058d1c7491facb70820467673332295",
                            "breakId": "flex.wt.break.v1.5b8f869fe3d965291d89312216273ee661da782349c5a82951c0cf3928045a38",
                            "timeStampOn": 1776024236146,
                            "timeStampOff": 1776025196699,
                            "sequenceNumber": 22,
                            "state": "OFF",
                            "type": "REST"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.203c53c60400b8164baf0c982a3636c27274bd825651e154de8e09725c350b79",
                            "breakId": null,
                            "timeStampOn": 1776031709000,
                            "timeStampOff": 1776033516000,
                            "sequenceNumber": 81,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031709.000000000,
                    "lastDriverEventTime": 1776040367650,
                    "lastVehicleMovementTime": 1776040012494,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTYR3XM3KKB08901",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-67",
                            "routeCode": "CX67"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2767,
                    "routeDeliveryProgress": {
                        "totalPickUps": 313,
                        "completedPickUps": 313,
                        "totalDeliveries": 313,
                        "completedDeliveries": 240,
                        "successfulDeliveries": 239,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 626,
                        "unassignedPackages": 0,
                        "completedTasks": 553,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 121,
                        "unassignedStops": 0,
                        "completedStops": 145,
                        "notStartedStops": 41,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 187,
                        "completedLocations": 190,
                        "totalLocations": 247,
                        "completedMultiLocationStops": 42,
                        "totalMultiLocationStops": 53,
                        "routePackageSummary": {
                            "DELIVERED": 239,
                            "REMAINING": 73,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 26,
                    "completedStopsInLastHour": 32,
                    "itineraryStartTime": 1776015703773,
                    "actualRouteDepartureTime": 1776020705998
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27515,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 24,
                    "packagesImpacted": 35
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 314,
                "completedPickUps": 314,
                "totalDeliveries": 314,
                "completedDeliveries": 241,
                "successfulDeliveries": 239,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 628,
                "unassignedPackages": 2,
                "completedTasks": 555,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 122,
                "unassignedStops": 1,
                "completedStops": 146,
                "notStartedStops": 41,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 188,
                "completedLocations": 191,
                "totalLocations": 248,
                "completedMultiLocationStops": 42,
                "totalMultiLocationStops": 53,
                "routePackageSummary": {
                    "DELIVERED": 239,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 73,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.948662,
                "longitude": -121.950183,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 4
                    },
                    "countByState": {
                        "PAST": 2,
                        "FUTURE": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 23.791753893479292,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "AMZXF6V3XY1WV",
            "preDispatch": false,
            "routeCreationTime": 1776006626,
            "rmsRouteId": "7aafb4d7-f637-4b49-8c89-f3a534e26f83",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-55",
            "routeCode": "CX55",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "10fd6409-763c-4565-9544-4582a16542a4",
                    "routeId": null,
                    "transporterId": "A1F8ORSCLI2D9Y",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "6f22fb54-296f-44e5-bf40-7790dc472b64",
                            "plannedStart": 1776025558000,
                            "plannedEnd": 1776026458000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.a22ec3327d9c1504129081a68a138fcd675ae9a7a53a6be1e55740014974173e",
                            "plannedStart": 1776032327946,
                            "plannedEnd": 1776034127946,
                            "plannedSequenceNumber": 76,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "2a0665cb-0feb-4f15-98ae-275ab764a013",
                            "plannedStart": 1776043152000,
                            "plannedEnd": 1776044052000,
                            "plannedSequenceNumber": 141,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.b9845dbe4b44128e3ecffd45a12eb66d56e779ac9aeb9a2713f33a86f59b986b",
                            "plannedStart": 1776054827946,
                            "plannedEnd": 1776056627946,
                            "plannedSequenceNumber": 189,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.af02ad6f2443642c4e7090a6268e323c85fd044afcfd25c279f357d5750c6817",
                            "breakId": "flex.wt.break.v1.a22ec3327d9c1504129081a68a138fcd675ae9a7a53a6be1e55740014974173e",
                            "timeStampOn": 1776031117089,
                            "timeStampOff": 1776032918581,
                            "sequenceNumber": 83,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031117.089000000,
                    "lastDriverEventTime": 1776040268070,
                    "lastVehicleMovementTime": 1776040013023,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "3C6MRVJG6ME562747",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-55",
                            "routeCode": "CX55"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1801,
                    "routeDeliveryProgress": {
                        "totalPickUps": 328,
                        "completedPickUps": 328,
                        "totalDeliveries": 328,
                        "completedDeliveries": 264,
                        "successfulDeliveries": 258,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 656,
                        "unassignedPackages": 0,
                        "completedTasks": 592,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 108,
                        "unassignedStops": 0,
                        "completedStops": 144,
                        "notStartedStops": 41,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 186,
                        "completedLocations": 197,
                        "totalLocations": 252,
                        "completedMultiLocationStops": 44,
                        "totalMultiLocationStops": 56,
                        "routePackageSummary": {
                            "DELIVERED": 258,
                            "REATTEMPTABLE": 1,
                            "REMAINING": 64,
                            "PICKUP_FAILED": 5
                        }
                    },
                    "stopCompletionRate": 22,
                    "completedStopsInLastHour": 32,
                    "itineraryStartTime": 1776015227951,
                    "actualRouteDepartureTime": 1776017186684
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 25556,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 36,
                    "packagesImpacted": 65
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 329,
                "completedPickUps": 329,
                "totalDeliveries": 329,
                "completedDeliveries": 265,
                "successfulDeliveries": 258,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 658,
                "unassignedPackages": 2,
                "completedTasks": 594,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 108,
                "unassignedStops": 1,
                "completedStops": 144,
                "notStartedStops": 41,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 198,
                "totalLocations": 253,
                "completedMultiLocationStops": 44,
                "totalMultiLocationStops": 56,
                "routePackageSummary": {
                    "DELIVERED": 258,
                    "UNDELIVERABLE": 1,
                    "REATTEMPTABLE": 1,
                    "REMAINING": 64,
                    "PICKUP_FAILED": 5
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.01653,
                "longitude": -121.876553,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 6
                    },
                    "countByState": {
                        "PAST": 5,
                        "FUTURE": 1
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 18.543316830924645,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1F8ORSCLI2D9Y",
            "preDispatch": false,
            "routeCreationTime": 1776006614,
            "rmsRouteId": "dad2ffa1-be0c-4211-9d51-e965b6b9eb1c",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16667179-14",
            "routeCode": "AX14",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776025800000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "46769721-2e9b-4781-a5d0-4a90b6dc3fd1",
                    "routeId": null,
                    "transporterId": "A22F5H642QP4A9",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "8fca5362-5d46-403e-9e5e-89d0a4e11e4a",
                            "plannedStart": 1776031850000,
                            "plannedEnd": 1776032750000,
                            "plannedSequenceNumber": 35,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.b0e20461977ecf6d155fb977da4ebb7ad4efa6956e7da8b4a317958a64aa46b2",
                            "plannedStart": 1776041663742,
                            "plannedEnd": 1776043463742,
                            "plannedSequenceNumber": 99,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "0344fe9e-af60-4ac4-92ce-c2a2df9ec623",
                            "plannedStart": 1776044413000,
                            "plannedEnd": 1776045313000,
                            "plannedSequenceNumber": 107,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.1502bc8e36279646d83bcc28b15848f875176ac28a374390db72737f78638b54",
                            "plannedStart": 1776064163742,
                            "plannedEnd": 1776065963742,
                            "plannedSequenceNumber": 143,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.3b92c79029dfff32032e49989df56b1215a59c7bd0ce5c27e6a2ebbed76d4551",
                            "breakId": "flex.wt.break.v1.b0e20461977ecf6d155fb977da4ebb7ad4efa6956e7da8b4a317958a64aa46b2",
                            "timeStampOn": 1776036459354,
                            "timeStampOff": 1776038261709,
                            "sequenceNumber": 54,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776036459.354000000,
                    "lastDriverEventTime": 1776040314519,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X86NKA02780",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16667179-14",
                            "routeCode": "AX14"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776060000000,
                    "timeRemainingSecs": 19557,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1802,
                    "routeDeliveryProgress": {
                        "totalPickUps": 146,
                        "completedPickUps": 146,
                        "totalDeliveries": 146,
                        "completedDeliveries": 71,
                        "successfulDeliveries": 71,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 292,
                        "unassignedPackages": 0,
                        "completedTasks": 217,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 57,
                        "unassignedStops": 0,
                        "completedStops": 69,
                        "notStartedStops": 69,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 139,
                        "completedLocations": 70,
                        "totalLocations": 144,
                        "completedMultiLocationStops": 1,
                        "totalMultiLocationStops": 5,
                        "routePackageSummary": {
                            "DELIVERED": 71,
                            "REMAINING": 75
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 15,
                    "itineraryStartTime": 1776024563747,
                    "actualRouteDepartureTime": 1776027535674
                }
            ],
            "serviceTypeName": "Standard Parcel - Large Van - Recycle",
            "routeDuration": 20241,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 11,
                    "packagesImpacted": 10
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 150,
                "completedPickUps": 146,
                "totalDeliveries": 150,
                "completedDeliveries": 71,
                "successfulDeliveries": 71,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 300,
                "unassignedPackages": 8,
                "completedTasks": 217,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 60,
                "unassignedStops": 4,
                "completedStops": 71,
                "notStartedStops": 71,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 143,
                "completedLocations": 70,
                "totalLocations": 148,
                "completedMultiLocationStops": 1,
                "totalMultiLocationStops": 5,
                "routePackageSummary": {
                    "DELIVERED": 71,
                    "UNDELIVERABLE": 2,
                    "REMAINING": 77
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.963409,
                "longitude": -121.753559,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 0.0,
                "dangerousProductsWeightUnit": null
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": null,
            "preDispatch": false,
            "routeCreationTime": 1776011488,
            "rmsRouteId": "777f9b0f-05f2-427f-a891-2b7c16ace852",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-71",
            "routeCode": "CX71",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "d8d51fb1-8426-4131-94f7-f5ae11113248",
                    "routeId": null,
                    "transporterId": "AEVO2MM3AMB4Q",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "dd71393b-b20f-4298-82ed-0fc4adaa8b50",
                            "plannedStart": 1776025210000,
                            "plannedEnd": 1776026110000,
                            "plannedSequenceNumber": 46,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.a39f8ed3fc45ee1fee386736ea7365e66589586ff52e6b50ed23184f60ab18c0",
                            "plannedStart": 1776032386790,
                            "plannedEnd": 1776034186790,
                            "plannedSequenceNumber": 75,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "5b9dcc58-42f6-436e-b5b4-1a701573a238",
                            "plannedStart": 1776042468000,
                            "plannedEnd": 1776043368000,
                            "plannedSequenceNumber": 140,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.5d3227cdce588ffc05f60bd69e14260ba4d6ac86583767b9c8740c6f96a2036a",
                            "plannedStart": 1776054886790,
                            "plannedEnd": 1776056686790,
                            "plannedSequenceNumber": 187,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.55aae6c281155fab2d73c19aece4aaf5687bd2b0b35d75b6f22e8be0709d648c",
                            "breakId": "flex.wt.break.v1.a39f8ed3fc45ee1fee386736ea7365e66589586ff52e6b50ed23184f60ab18c0",
                            "timeStampOn": 1776026008741,
                            "timeStampOff": 1776027992699,
                            "sequenceNumber": 51,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776026008.741000000,
                    "lastDriverEventTime": 1776040327531,
                    "lastVehicleMovementTime": 1776040012865,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X82MKA54339",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-71",
                            "routeCode": "CX71"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1983,
                    "routeDeliveryProgress": {
                        "totalPickUps": 319,
                        "completedPickUps": 319,
                        "totalDeliveries": 319,
                        "completedDeliveries": 247,
                        "successfulDeliveries": 245,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 638,
                        "unassignedPackages": 0,
                        "completedTasks": 566,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 120,
                        "unassignedStops": 0,
                        "completedStops": 143,
                        "notStartedStops": 43,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 187,
                        "completedLocations": 185,
                        "totalLocations": 244,
                        "completedMultiLocationStops": 34,
                        "totalMultiLocationStops": 47,
                        "routePackageSummary": {
                            "DELIVERED": 245,
                            "REMAINING": 72,
                            "PICKUP_FAILED": 2
                        }
                    },
                    "stopCompletionRate": 22,
                    "completedStopsInLastHour": 30,
                    "itineraryStartTime": 1776015286794,
                    "actualRouteDepartureTime": 1776017083608
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 25663,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 24,
                    "packagesImpacted": 49
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 321,
                "completedPickUps": 321,
                "totalDeliveries": 321,
                "completedDeliveries": 249,
                "successfulDeliveries": 245,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 642,
                "unassignedPackages": 4,
                "completedTasks": 570,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 121,
                "unassignedStops": 2,
                "completedStops": 145,
                "notStartedStops": 43,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 189,
                "completedLocations": 187,
                "totalLocations": 246,
                "completedMultiLocationStops": 34,
                "totalMultiLocationStops": 47,
                "routePackageSummary": {
                    "DELIVERED": 245,
                    "UNDELIVERABLE": 2,
                    "REMAINING": 72,
                    "PICKUP_FAILED": 2
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.972624,
                "longitude": -121.965588,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 24.953039000177256,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "AEVO2MM3AMB4Q",
            "preDispatch": false,
            "routeCreationTime": 1776006610,
            "rmsRouteId": "d86ee2d3-57d9-4e27-9978-9b72f3bf66da",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-58",
            "routeCode": "CX58",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "7c899e9b-3152-437c-85ef-4eface1245b0",
                    "routeId": null,
                    "transporterId": "A3FMNL9Y6KDN8Y",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "1c390550-37ba-4d52-8846-ea4f19b2afb2",
                            "plannedStart": 1776025420000,
                            "plannedEnd": 1776026320000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.cbe6fe38e1443f0e1970c2d28d0d3d976d3296d5570149dbbbc2c2d2fd871ee4",
                            "plannedStart": 1776032455880,
                            "plannedEnd": 1776034255880,
                            "plannedSequenceNumber": 95,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "c3ff3a60-b092-4b06-b7d4-8d07c54c94e7",
                            "plannedStart": 1776039892000,
                            "plannedEnd": 1776040792000,
                            "plannedSequenceNumber": 141,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.93aa1bd9a57972f3686335c98121d64fd45b939dc6b0d8defaf0f7f2a6829b16",
                            "plannedStart": 1776054955880,
                            "plannedEnd": 1776056755880,
                            "plannedSequenceNumber": 189,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.3515191b0620874dc6291803e8fb605b9c878237e5cd433eccee8a720f718f65",
                            "breakId": "flex.wt.break.v1.cbe6fe38e1443f0e1970c2d28d0d3d976d3296d5570149dbbbc2c2d2fd871ee4",
                            "timeStampOn": 1776032108531,
                            "timeStampOff": 1776033909709,
                            "sequenceNumber": 101,
                            "state": "OFF",
                            "type": "MEAL"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.ede8d60f846e3e1f6fc90410373559d5991f60d50cc7a53961e3637a4e69aee3",
                            "breakId": "flex.wt.break.v1.9759e1b86b5d2e59ecdc3aa924a63b6809d11c0df4a25116e0bd6c71bd728a1f",
                            "timeStampOn": 1776024004755,
                            "timeStampOff": 1776024592454,
                            "sequenceNumber": 37,
                            "state": "OFF",
                            "type": "REST"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.432ca254b9af485b710c74a94dcb7f16d92058b9f47b6a09ad76dcc3bdf2f1de",
                            "breakId": "flex.wt.break.v1.0ec55de221afc8b17a780c9fc25cf1c143887c19c4d5191558a7ed92b18e1b75",
                            "timeStampOn": 1776040223194,
                            "timeStampOff": null,
                            "sequenceNumber": 154,
                            "state": "ON",
                            "type": "REST"
                        }
                    ],
                    "currentBreakStatus": "ON",
                    "currentBreakTimeStampOn": 1776040223.194000000,
                    "lastDriverEventTime": 1776040052984,
                    "lastVehicleMovementTime": 1776039704804,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X87LKA48292",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-58",
                            "routeCode": "CX58"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2608,
                    "routeDeliveryProgress": {
                        "totalPickUps": 324,
                        "completedPickUps": 324,
                        "totalDeliveries": 324,
                        "completedDeliveries": 265,
                        "successfulDeliveries": 264,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 648,
                        "unassignedPackages": 0,
                        "completedTasks": 589,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 116,
                        "unassignedStops": 0,
                        "completedStops": 152,
                        "notStartedStops": 35,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 187,
                        "completedLocations": 209,
                        "totalLocations": 257,
                        "completedMultiLocationStops": 54,
                        "totalMultiLocationStops": 66,
                        "routePackageSummary": {
                            "DELIVERED": 264,
                            "REMAINING": 59,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 25,
                    "completedStopsInLastHour": 28,
                    "itineraryStartTime": 1776015355885,
                    "actualRouteDepartureTime": 1776018150121
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 26318,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 36,
                    "packagesImpacted": 70
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 324,
                "completedPickUps": 324,
                "totalDeliveries": 324,
                "completedDeliveries": 265,
                "successfulDeliveries": 264,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 648,
                "unassignedPackages": 0,
                "completedTasks": 589,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 116,
                "unassignedStops": 0,
                "completedStops": 152,
                "notStartedStops": 35,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 209,
                "totalLocations": 257,
                "completedMultiLocationStops": 54,
                "totalMultiLocationStops": 66,
                "routePackageSummary": {
                    "DELIVERED": 264,
                    "REMAINING": 59,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.006643,
                "longitude": -121.891526,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 2
                    },
                    "countByState": {
                        "PAST": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 19.725152791260577,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A3FMNL9Y6KDN8Y",
            "preDispatch": false,
            "routeCreationTime": 1776006614,
            "rmsRouteId": "00dbfaf6-f72f-4b49-9d3e-68c0f0f24c4a",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-50",
            "routeCode": "CX50",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "5fb5ab76-d4e4-468f-a553-4e62d1bcadad",
                    "routeId": null,
                    "transporterId": "A1VKNOXZ9UEBDN",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "62932c36-7ced-4634-8299-d00033ae979b",
                            "plannedStart": 1776025710000,
                            "plannedEnd": 1776026610000,
                            "plannedSequenceNumber": 46,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.9472d4822bb513d1e7e799d61c1c861a81924b03e38902f65c33d1edbf25ac47",
                            "plannedStart": 1776032298299,
                            "plannedEnd": 1776034098299,
                            "plannedSequenceNumber": 87,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "36b4e0a4-5e45-4938-a9fb-7aeef6a7b188",
                            "plannedStart": 1776041367000,
                            "plannedEnd": 1776042267000,
                            "plannedSequenceNumber": 140,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.dcbac2338ec874610166386246b6949d60fafa91f07883411a169ae41510f19c",
                            "plannedStart": 1776054798299,
                            "plannedEnd": 1776056598299,
                            "plannedSequenceNumber": 187,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.d1aef8c4b3203067ed011cc12a04a4ce9e0ad186bd8bd7a2873cef43a2c8facd",
                            "breakId": "flex.wt.break.v1.9472d4822bb513d1e7e799d61c1c861a81924b03e38902f65c33d1edbf25ac47",
                            "timeStampOn": 1776031447405,
                            "timeStampOff": 1776033251143,
                            "sequenceNumber": 76,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031447.405000000,
                    "lastDriverEventTime": 1776040346789,
                    "lastVehicleMovementTime": 1776039706014,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "3C6MRVJG7ME562580",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-50",
                            "routeCode": "CX50"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1803,
                    "routeDeliveryProgress": {
                        "totalPickUps": 303,
                        "completedPickUps": 303,
                        "totalDeliveries": 303,
                        "completedDeliveries": 197,
                        "successfulDeliveries": 197,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 606,
                        "unassignedPackages": 0,
                        "completedTasks": 500,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 118,
                        "unassignedStops": 0,
                        "completedStops": 125,
                        "notStartedStops": 61,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 187,
                        "completedLocations": 149,
                        "totalLocations": 237,
                        "completedMultiLocationStops": 23,
                        "totalMultiLocationStops": 46,
                        "routePackageSummary": {
                            "DELIVERED": 197,
                            "REMAINING": 106
                        }
                    },
                    "stopCompletionRate": 20,
                    "completedStopsInLastHour": 29,
                    "itineraryStartTime": 1776015198304,
                    "actualRouteDepartureTime": 1776018334318
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27603,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 7,
                    "packagesImpacted": 11
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 303,
                "completedPickUps": 303,
                "totalDeliveries": 303,
                "completedDeliveries": 197,
                "successfulDeliveries": 197,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 606,
                "unassignedPackages": 0,
                "completedTasks": 500,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 118,
                "unassignedStops": 0,
                "completedStops": 125,
                "notStartedStops": 61,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 187,
                "completedLocations": 149,
                "totalLocations": 237,
                "completedMultiLocationStops": 23,
                "totalMultiLocationStops": 46,
                "routePackageSummary": {
                    "DELIVERED": 197,
                    "REMAINING": 106
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.014153,
                "longitude": -121.804139,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 11.291008436302622,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1VKNOXZ9UEBDN",
            "preDispatch": false,
            "routeCreationTime": 1776006615,
            "rmsRouteId": "89c15288-e175-4c48-bb0e-5df4b8b3d09b",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-62",
            "routeCode": "CX62",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "5b5761ff-64b2-4de9-a0af-2a5761facc4c",
                    "routeId": null,
                    "transporterId": "A10DSFXFJK261W",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "1546016f-653f-4616-948f-8b9980aec27d",
                            "plannedStart": 1776025372000,
                            "plannedEnd": 1776026272000,
                            "plannedSequenceNumber": 40,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.f5f99d764695e035283315092fd407d2b8101e4150360a1ec3479aededdf0880",
                            "plannedStart": 1776032313923,
                            "plannedEnd": 1776034113923,
                            "plannedSequenceNumber": 75,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "e83e2655-09e5-45d2-a054-4457e26e16d8",
                            "plannedStart": 1776039692000,
                            "plannedEnd": 1776040592000,
                            "plannedSequenceNumber": 122,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.38c0f33caadc24888f554427fdffab30238ff9b81bbce592c33e23467dff6f23",
                            "plannedStart": 1776054813923,
                            "plannedEnd": 1776056613923,
                            "plannedSequenceNumber": 163,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.8d63af88c873d815c385f7a73856dfce82c4f7011f9713c57e80aa2a90fd8aa9",
                            "breakId": "flex.wt.break.v1.f5f99d764695e035283315092fd407d2b8101e4150360a1ec3479aededdf0880",
                            "timeStampOn": 1776031205620,
                            "timeStampOff": 1776033008920,
                            "sequenceNumber": 75,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031205.620000000,
                    "lastDriverEventTime": 1776040378131,
                    "lastVehicleMovementTime": 1776040320368,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X86MKA54277",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-62",
                            "routeCode": "CX62"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1803,
                    "routeDeliveryProgress": {
                        "totalPickUps": 284,
                        "completedPickUps": 284,
                        "totalDeliveries": 284,
                        "completedDeliveries": 207,
                        "successfulDeliveries": 206,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 568,
                        "unassignedPackages": 0,
                        "completedTasks": 491,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 98,
                        "unassignedStops": 0,
                        "completedStops": 121,
                        "notStartedStops": 40,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 162,
                        "completedLocations": 162,
                        "totalLocations": 219,
                        "completedMultiLocationStops": 35,
                        "totalMultiLocationStops": 48,
                        "routePackageSummary": {
                            "DELIVERED": 206,
                            "REMAINING": 77,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 27,
                    "itineraryStartTime": 1776015213929,
                    "actualRouteDepartureTime": 1776017514000
                }
            ],
            "serviceTypeName": "Nursery Route Level 2",
            "routeDuration": 27341,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 22,
                    "packagesImpacted": 26
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 284,
                "completedPickUps": 284,
                "totalDeliveries": 284,
                "completedDeliveries": 207,
                "successfulDeliveries": 206,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 568,
                "unassignedPackages": 0,
                "completedTasks": 491,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 98,
                "unassignedStops": 0,
                "completedStops": 120,
                "notStartedStops": 40,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 162,
                "completedLocations": 162,
                "totalLocations": 219,
                "completedMultiLocationStops": 35,
                "totalMultiLocationStops": 48,
                "routePackageSummary": {
                    "DELIVERED": 206,
                    "REMAINING": 77,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.999943,
                "longitude": -121.825485,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 1
                    },
                    "countByState": {
                        "PAST": 1
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 5.965581099831992,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A10DSFXFJK261W",
            "preDispatch": false,
            "routeCreationTime": 1776006624,
            "rmsRouteId": "3aeb8f9e-1b6e-4acb-9a48-f7f9eaca1ac1",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-54",
            "routeCode": "CX54",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "3b18d882-8c3d-4baa-a4c4-329b7e371b8f",
                    "routeId": null,
                    "transporterId": "A1HOCU7X2G5B6F",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "52f4afec-f269-4d91-be74-64ceb81131af",
                            "plannedStart": 1776025095000,
                            "plannedEnd": 1776025995000,
                            "plannedSequenceNumber": 46,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.2d1ba95c4abf4930a104ba5aaa0a64b7177cfc78720a119420c0fedf2dffc4e7",
                            "plannedStart": 1776032665702,
                            "plannedEnd": 1776034465702,
                            "plannedSequenceNumber": 74,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "653e6a22-347a-40ba-9045-6d6c3a9575db",
                            "plannedStart": 1776043383000,
                            "plannedEnd": 1776044283000,
                            "plannedSequenceNumber": 140,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.644be28c7737b7315047ddfd16fefa593c44442ec9761fced7d37dcaf9a9c285",
                            "plannedStart": 1776055165702,
                            "plannedEnd": 1776056965702,
                            "plannedSequenceNumber": 187,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.0eb924fffbe786fa927f7b2d67514d43ff6e919a6be5da9c83e056ab43d89c5d",
                            "breakId": "flex.wt.break.v1.46ce0dac1366c043ca7b2d01fdb8de6819e76cd7180b80ac9acafaa76545487e",
                            "timeStampOn": 1776038414985,
                            "timeStampOff": 1776039302010,
                            "sequenceNumber": 124,
                            "state": "OFF",
                            "type": "REST"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.2ba67ac9e706c61f0f5c3f86cfa1abe63cdabbb51589c37a662f3664009cf6cf",
                            "breakId": "flex.wt.break.v1.2d1ba95c4abf4930a104ba5aaa0a64b7177cfc78720a119420c0fedf2dffc4e7",
                            "timeStampOn": 1776029596921,
                            "timeStampOff": 1776031398640,
                            "sequenceNumber": 68,
                            "state": "OFF",
                            "type": "MEAL"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.767554347fa43e2836494752d726a51846d5838b57c8eaf99194877d20b661a8",
                            "breakId": "flex.wt.break.v1.1734e04968a5a4120ebb25de622324f44eb136651c9d8c43c8ecc78ec6d181f9",
                            "timeStampOn": 1776024027272,
                            "timeStampOff": 1776024935335,
                            "sequenceNumber": 44,
                            "state": "OFF",
                            "type": "REST"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776038414.985000000,
                    "lastDriverEventTime": 1776040289194,
                    "lastVehicleMovementTime": 1776039705738,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X82MKA54731",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-54",
                            "routeCode": "CX54"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 3596,
                    "routeDeliveryProgress": {
                        "totalPickUps": 311,
                        "completedPickUps": 311,
                        "totalDeliveries": 311,
                        "completedDeliveries": 224,
                        "successfulDeliveries": 222,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 622,
                        "unassignedPackages": 0,
                        "completedTasks": 535,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 112,
                        "unassignedStops": 0,
                        "completedStops": 133,
                        "notStartedStops": 51,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 184,
                        "completedLocations": 190,
                        "totalLocations": 256,
                        "completedMultiLocationStops": 46,
                        "totalMultiLocationStops": 59,
                        "routePackageSummary": {
                            "DELIVERED": 222,
                            "REMAINING": 87,
                            "PICKUP_FAILED": 2
                        }
                    },
                    "stopCompletionRate": 20,
                    "completedStopsInLastHour": 23,
                    "itineraryStartTime": 1776015565707,
                    "actualRouteDepartureTime": 1776016881542
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27536,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 20,
                    "packagesImpacted": 32
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 312,
                "completedPickUps": 312,
                "totalDeliveries": 312,
                "completedDeliveries": 225,
                "successfulDeliveries": 222,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 624,
                "unassignedPackages": 2,
                "completedTasks": 537,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 113,
                "unassignedStops": 1,
                "completedStops": 133,
                "notStartedStops": 51,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 185,
                "completedLocations": 191,
                "totalLocations": 257,
                "completedMultiLocationStops": 46,
                "totalMultiLocationStops": 59,
                "routePackageSummary": {
                    "DELIVERED": 222,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 87,
                    "PICKUP_FAILED": 2
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.023907,
                "longitude": -121.8797533,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 2
                    },
                    "countByState": {
                        "PAST": 1,
                        "FUTURE": 1
                    },
                    "summaryDetail": null
                },
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 7
                    },
                    "countByState": {
                        "PAST": 7
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 39.26381648020226,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1HOCU7X2G5B6F",
            "preDispatch": false,
            "routeCreationTime": 1776006613,
            "rmsRouteId": "1d564333-326f-4a47-a88e-3c1cb5f22340",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-49",
            "routeCode": "CX49",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "32e98261-05a1-4f74-b39f-ac98b35269f1",
                    "routeId": null,
                    "transporterId": "A36NKWFXMN0GKA",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "38484555-eec3-4325-8a0f-bd06f7cdd592",
                            "plannedStart": 1776023731000,
                            "plannedEnd": 1776024631000,
                            "plannedSequenceNumber": 45,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.b74e8201d6332088c07d4a27aeb9bc8a8bc2017e3c8b77d7ec6189a3e4de39f5",
                            "plannedStart": 1776032474030,
                            "plannedEnd": 1776034274030,
                            "plannedSequenceNumber": 103,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "037d7c44-fd05-440e-b2b3-f3dc171e18f2",
                            "plannedStart": 1776038590000,
                            "plannedEnd": 1776039490000,
                            "plannedSequenceNumber": 136,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.2b8427a22ea85792cba159b7ca32eedc53305cb1c079fa6534845cc194a39938",
                            "plannedStart": 1776054974030,
                            "plannedEnd": 1776056774030,
                            "plannedSequenceNumber": 182,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.5f9a93af8aea5fe6cbc9a7c8ee117dd58980d08c988676d91fff8cb1406b901e",
                            "breakId": "flex.wt.break.v1.b74e8201d6332088c07d4a27aeb9bc8a8bc2017e3c8b77d7ec6189a3e4de39f5",
                            "timeStampOn": 1776031077400,
                            "timeStampOff": 1776032920192,
                            "sequenceNumber": 87,
                            "state": "OFF",
                            "type": "MEAL"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.62268c11d354a3e5f67c76b0b78770952861e472f246b614b5d6c5fc67d6299c",
                            "breakId": "flex.wt.break.v1.682f1508f19137c3476983c731f1de7879c665bb6eac7c331b0ef6ef83857df0",
                            "timeStampOn": 1776021260140,
                            "timeStampOff": 1776021739987,
                            "sequenceNumber": 23,
                            "state": "OFF",
                            "type": "REST"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031077.400000000,
                    "lastDriverEventTime": 1776040270282,
                    "lastVehicleMovementTime": 1776039398065,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X83MKA54575",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-49",
                            "routeCode": "CX49"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2322,
                    "routeDeliveryProgress": {
                        "totalPickUps": 291,
                        "completedPickUps": 291,
                        "totalDeliveries": 291,
                        "completedDeliveries": 220,
                        "successfulDeliveries": 219,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 582,
                        "unassignedPackages": 0,
                        "completedTasks": 511,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 113,
                        "unassignedStops": 0,
                        "completedStops": 137,
                        "notStartedStops": 44,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 182,
                        "completedLocations": 172,
                        "totalLocations": 229,
                        "completedMultiLocationStops": 33,
                        "totalMultiLocationStops": 45,
                        "routePackageSummary": {
                            "DELIVERED": 219,
                            "REMAINING": 71,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 21,
                    "completedStopsInLastHour": 26,
                    "itineraryStartTime": 1776015374036,
                    "actualRouteDepartureTime": 1776017295955
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 25795,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 25,
                    "packagesImpacted": 40
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 292,
                "completedPickUps": 292,
                "totalDeliveries": 292,
                "completedDeliveries": 221,
                "successfulDeliveries": 219,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 584,
                "unassignedPackages": 2,
                "completedTasks": 513,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 113,
                "unassignedStops": 1,
                "completedStops": 138,
                "notStartedStops": 44,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 183,
                "completedLocations": 173,
                "totalLocations": 230,
                "completedMultiLocationStops": 33,
                "totalMultiLocationStops": 45,
                "routePackageSummary": {
                    "DELIVERED": 219,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 71,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.994282,
                "longitude": -121.816401,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 1
                    },
                    "countByState": {
                        "FUTURE": 1
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 8.657960317983305,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A36NKWFXMN0GKA",
            "preDispatch": false,
            "routeCreationTime": 1776006615,
            "rmsRouteId": "3fdd345c-29d9-400f-bd3c-29d67b5c2ce5",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-69",
            "routeCode": "CX69",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "caa06bcf-c9af-4f15-9a7d-9a57558694df",
                    "routeId": null,
                    "transporterId": "A32IQZOM46IZF7",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "d994fb91-ad00-4a0e-b3d1-687f26fbd38a",
                            "plannedStart": 1776028884000,
                            "plannedEnd": 1776029784000,
                            "plannedSequenceNumber": 41,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.61962ef3af9a83f334ce0da6db439475053f85cf6b68c8f418a719d58168d406",
                            "plannedStart": 1776032922299,
                            "plannedEnd": 1776034722299,
                            "plannedSequenceNumber": 61,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "7777f680-265c-48a7-a2a8-15487074f728",
                            "plannedStart": 1776044135000,
                            "plannedEnd": 1776045035000,
                            "plannedSequenceNumber": 125,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.bc7ebcbb0cc67df442d92c66fcc75c943becda7bbe3a46ae4760eb94799d273a",
                            "plannedStart": 1776055422299,
                            "plannedEnd": 1776057222299,
                            "plannedSequenceNumber": 167,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.0971a79362f2c12e097ed956ff5d16ca3f3a8dda8331efb684c91abf3e531ff4",
                            "breakId": null,
                            "timeStampOn": 1776031648000,
                            "timeStampOff": 1776031696000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.2803b8c0eac9503291d8e12d81fcd858cab8a864e63523361911b79b4cab7a87",
                            "breakId": null,
                            "timeStampOn": 1776031446000,
                            "timeStampOff": 1776031635000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.2d20a0677b68b332fcc54c121bb077be8a9234c8ed797c949e8dff1d79aa8154",
                            "breakId": null,
                            "timeStampOn": 1776031644000,
                            "timeStampOff": 1776031645000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.fca3a6c4caf649de20febefcdb45317fdf7a1ce6e3f9744e88a1f3d263372c76",
                            "breakId": null,
                            "timeStampOn": 1776031432000,
                            "timeStampOff": 1776031435000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.06ba1f62fd6182b0fd412dd33ddcc702c04a61a0f8a26c1ec53430a50a735f52",
                            "breakId": null,
                            "timeStampOn": 1776031700000,
                            "timeStampOff": 1776033634000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.bd850004a4b3351e6cd6cfc42536dc0b3b7e8d88ab16554d06dad34c69d79dfb",
                            "breakId": null,
                            "timeStampOn": 1776031637000,
                            "timeStampOff": 1776031696000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.c5cd809093c9e7c26a4c346358905f248a01f52226bbbf706b689821f6194e8a",
                            "breakId": null,
                            "timeStampOn": 1776031646000,
                            "timeStampOff": 1776031647000,
                            "sequenceNumber": 64,
                            "state": "OFF",
                            "type": "PUNCH_ONLY"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031700.000000000,
                    "lastDriverEventTime": 1776040225435,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X82PKA60226",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-69",
                            "routeCode": "CX69"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2235,
                    "routeDeliveryProgress": {
                        "totalPickUps": 285,
                        "completedPickUps": 285,
                        "totalDeliveries": 285,
                        "completedDeliveries": 181,
                        "successfulDeliveries": 180,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 570,
                        "unassignedPackages": 0,
                        "completedTasks": 466,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 107,
                        "unassignedStops": 0,
                        "completedStops": 102,
                        "notStartedStops": 62,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 165,
                        "completedLocations": 148,
                        "totalLocations": 230,
                        "completedMultiLocationStops": 37,
                        "totalMultiLocationStops": 54,
                        "routePackageSummary": {
                            "DELIVERED": 180,
                            "REMAINING": 104,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 16,
                    "completedStopsInLastHour": 21,
                    "itineraryStartTime": 1776015822304,
                    "actualRouteDepartureTime": 1776017674842
                },
                {
                    "itineraryId": "90637e48-ec1d-4e72-a4ca-ec15a7a7341f",
                    "routeId": null,
                    "transporterId": "AB06077WGSV8G",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "ca213ce2-223b-4b34-8705-d4ffea599ead",
                            "plannedStart": 1776030186000,
                            "plannedEnd": 1776031086000,
                            "plannedSequenceNumber": 15,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "a98c5fe5-3ff7-4d0d-a2b9-3cb981d02ee3",
                            "plannedStart": 1776033923000,
                            "plannedEnd": 1776035723000,
                            "plannedSequenceNumber": 31,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "10eec648-c4cb-439b-b382-e40c2b46a684",
                            "plannedStart": 1776038295000,
                            "plannedEnd": 1776039195000,
                            "plannedSequenceNumber": 47,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776039337868,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": null,
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-69",
                            "routeCode": "CX69"
                        },
                        {
                            "routeId": "16666856-57",
                            "routeCode": "CX57"
                        },
                        {
                            "routeId": "16666856-60",
                            "routeCode": "CX60"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "COMPLETED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": true,
                    "scheduleEndTime": 1776039385255,
                    "timeRemainingSecs": 18657,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 38,
                        "completedPickUps": 38,
                        "totalDeliveries": 38,
                        "completedDeliveries": 38,
                        "successfulDeliveries": 38,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 76,
                        "unassignedPackages": 0,
                        "completedTasks": 76,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 1,
                        "unassignedStops": 0,
                        "completedStops": 20,
                        "notStartedStops": 0,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 20,
                        "completedLocations": 29,
                        "totalLocations": 29,
                        "completedMultiLocationStops": 8,
                        "totalMultiLocationStops": 9,
                        "routePackageSummary": {
                            "DELIVERED": 38,
                            "REMAINING": 0
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 14,
                    "itineraryStartTime": 1776023171422,
                    "actualRouteDepartureTime": 1776026597031
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 32286,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 12,
                    "packagesImpacted": 30
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 323,
                "completedPickUps": 323,
                "totalDeliveries": 323,
                "completedDeliveries": 219,
                "successfulDeliveries": 218,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 646,
                "unassignedPackages": 0,
                "completedTasks": 542,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 107,
                "unassignedStops": 0,
                "completedStops": 119,
                "notStartedStops": 62,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 183,
                "completedLocations": 175,
                "totalLocations": 257,
                "completedMultiLocationStops": 45,
                "totalMultiLocationStops": 62,
                "routePackageSummary": {
                    "DELIVERED": 218,
                    "REMAINING": 104,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.963119,
                "longitude": -121.942289,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 2
                    },
                    "countByState": {
                        "PAST": 2
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 14.399230154053809,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A32IQZOM46IZF7",
            "preDispatch": false,
            "routeCreationTime": 1776006609,
            "rmsRouteId": "a6d5200c-043e-4f38-b358-1dbebdc71389",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-48",
            "routeCode": "CX48",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018600000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "f50fdb51-92a0-4056-81ce-18926fee87f3",
                    "routeId": null,
                    "transporterId": "A3K43EXQE4MOZQ",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "3da161c7-f7c1-4d83-934d-e23c3ac640cb",
                            "plannedStart": 1776024806000,
                            "plannedEnd": 1776025706000,
                            "plannedSequenceNumber": 45,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.8a516e2ebfa811367f81c3dfd092124593cd6cd59ee6415a39dc06bac639ffc9",
                            "plannedStart": 1776032860952,
                            "plannedEnd": 1776034660952,
                            "plannedSequenceNumber": 98,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "f983dd01-0b31-4d54-b497-290e0a5e94d5",
                            "plannedStart": 1776041127000,
                            "plannedEnd": 1776042027000,
                            "plannedSequenceNumber": 137,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.b27d22aef3ae56e8be016a76a6661aa1029fd434034a8fe6195e64c15294faea",
                            "plannedStart": 1776055360952,
                            "plannedEnd": 1776057160952,
                            "plannedSequenceNumber": 183,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.e806d30c9995b969332d5d6357e80c223375b7bca6945e74a1ee5cf257ebf2c8",
                            "breakId": "flex.wt.break.v1.5a1ff66c3ee2095c709cd20d0455a2e448816d923ec8726a014040bc654ba7e2",
                            "timeStampOn": 1776024653172,
                            "timeStampOff": 1776025578593,
                            "sequenceNumber": 47,
                            "state": "OFF",
                            "type": "REST"
                        },
                        {
                            "punchId": "flex.wt.punch.v1.f6e7595dfe3b94bf146e030f95bc4e1ca7040b581944b8d92a5e4181a2d74965",
                            "breakId": "flex.wt.break.v1.8a516e2ebfa811367f81c3dfd092124593cd6cd59ee6415a39dc06bac639ffc9",
                            "timeStampOn": 1776031286785,
                            "timeStampOff": 1776033107193,
                            "sequenceNumber": 92,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031286.785000000,
                    "lastDriverEventTime": 1776040244508,
                    "lastVehicleMovementTime": 1776039705716,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X83MKA54480",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-48",
                            "routeCode": "CX48"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053400000,
                    "timeRemainingSecs": 12957,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 2745,
                    "routeDeliveryProgress": {
                        "totalPickUps": 307,
                        "completedPickUps": 307,
                        "totalDeliveries": 307,
                        "completedDeliveries": 212,
                        "successfulDeliveries": 212,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 614,
                        "unassignedPackages": 0,
                        "completedTasks": 519,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 125,
                        "unassignedStops": 0,
                        "completedStops": 133,
                        "notStartedStops": 49,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 183,
                        "completedLocations": 173,
                        "totalLocations": 242,
                        "completedMultiLocationStops": 29,
                        "totalMultiLocationStops": 43,
                        "routePackageSummary": {
                            "DELIVERED": 212,
                            "REMAINING": 95
                        }
                    },
                    "stopCompletionRate": 21,
                    "completedStopsInLastHour": 22,
                    "itineraryStartTime": 1776015760957,
                    "actualRouteDepartureTime": 1776017802404
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27393,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 7,
                    "packagesImpacted": 12
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 308,
                "completedPickUps": 308,
                "totalDeliveries": 308,
                "completedDeliveries": 213,
                "successfulDeliveries": 212,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 616,
                "unassignedPackages": 2,
                "completedTasks": 521,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 125,
                "unassignedStops": 0,
                "completedStops": 132,
                "notStartedStops": 49,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 183,
                "completedLocations": 174,
                "totalLocations": 243,
                "completedMultiLocationStops": 29,
                "totalMultiLocationStops": 43,
                "routePackageSummary": {
                    "DELIVERED": 212,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 95
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.99570616094359,
                "longitude": -121.82927669080735,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 15.204984739932904,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A3K43EXQE4MOZQ",
            "preDispatch": false,
            "routeCreationTime": 1776006616,
            "rmsRouteId": "ae2e1133-9538-442b-8fab-71e6f60c8fd5",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-68",
            "routeCode": "CX68",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "4432d713-2d35-40fa-803f-68358e4e5140",
                    "routeId": null,
                    "transporterId": "A289JG6MS84PU",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "36968d27-c599-4f53-b7d9-f123de180e2f",
                            "plannedStart": 1776026658000,
                            "plannedEnd": 1776027558000,
                            "plannedSequenceNumber": 46,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.7430b5803e6faf6ca93e7442e64e6ab49b5bf42f3def5cdef07b64a7b9876dfa",
                            "plannedStart": 1776032314890,
                            "plannedEnd": 1776034114890,
                            "plannedSequenceNumber": 80,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "b5a9b044-6f7a-43a6-ad3f-4790226ec6c5",
                            "plannedStart": 1776041467000,
                            "plannedEnd": 1776042367000,
                            "plannedSequenceNumber": 138,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.3bf0f196bbaa68f33a718e900f1fcf1539fe229ad545b9552a0c27677ef8be27",
                            "plannedStart": 1776054814890,
                            "plannedEnd": 1776056614890,
                            "plannedSequenceNumber": 185,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.ae8d7973158740b51f6a0648194bbb68f43172e38cc02ac5f34ee4fff707ca05",
                            "breakId": "flex.wt.break.v1.7430b5803e6faf6ca93e7442e64e6ab49b5bf42f3def5cdef07b64a7b9876dfa",
                            "timeStampOn": 1776031625284,
                            "timeStampOff": 1776033445858,
                            "sequenceNumber": 88,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031625.284000000,
                    "lastDriverEventTime": 1776040375213,
                    "lastVehicleMovementTime": 1776040011805,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X88LKA56112",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-68",
                            "routeCode": "CX68"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1820,
                    "routeDeliveryProgress": {
                        "totalPickUps": 322,
                        "completedPickUps": 322,
                        "totalDeliveries": 322,
                        "completedDeliveries": 255,
                        "successfulDeliveries": 253,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 644,
                        "unassignedPackages": 0,
                        "completedTasks": 577,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 110,
                        "unassignedStops": 0,
                        "completedStops": 146,
                        "notStartedStops": 39,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 186,
                        "completedLocations": 200,
                        "totalLocations": 254,
                        "completedMultiLocationStops": 42,
                        "totalMultiLocationStops": 51,
                        "routePackageSummary": {
                            "DELIVERED": 253,
                            "UNDELIVERABLE": 1,
                            "REMAINING": 67,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 23,
                    "completedStopsInLastHour": 35,
                    "itineraryStartTime": 1776015214896,
                    "actualRouteDepartureTime": 1776018303298
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27931,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 36,
                    "packagesImpacted": 62
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 322,
                "completedPickUps": 322,
                "totalDeliveries": 322,
                "completedDeliveries": 255,
                "successfulDeliveries": 253,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 644,
                "unassignedPackages": 0,
                "completedTasks": 577,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 110,
                "unassignedStops": 0,
                "completedStops": 146,
                "notStartedStops": 39,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 186,
                "completedLocations": 200,
                "totalLocations": 254,
                "completedMultiLocationStops": 42,
                "totalMultiLocationStops": 51,
                "routePackageSummary": {
                    "DELIVERED": 253,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 67,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.940957,
                "longitude": -121.93132,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 24.800937612773335,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A289JG6MS84PU",
            "preDispatch": false,
            "routeCreationTime": 1776006608,
            "rmsRouteId": "a5cd7104-b549-4de1-8ede-dd5cb804925c",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16667179-15",
            "routeCode": "AX15",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776025800000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "5bfa677e-f0b0-426f-a38f-e18a3edc28d6",
                    "routeId": null,
                    "transporterId": "A3LST21WHOWCNV",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "da38cf4d-fbc6-4638-b987-807c89467de6",
                            "plannedStart": 1776033672000,
                            "plannedEnd": 1776034572000,
                            "plannedSequenceNumber": 36,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.bc9f5ffa0deb9d6e4c7b7665f3b54973a81ad94cc9c100901b09ed012e9fa662",
                            "plannedStart": 1776041703062,
                            "plannedEnd": 1776043503062,
                            "plannedSequenceNumber": 73,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "f5293f19-6765-4806-a27c-da950162cce9",
                            "plannedStart": 1776049135000,
                            "plannedEnd": 1776050035000,
                            "plannedSequenceNumber": 108,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.cacee6c93124a34f5f63d8ef0c7f81c53e81041e01a9be530cf39fc21a46a6cd",
                            "plannedStart": 1776064203062,
                            "plannedEnd": 1776066003062,
                            "plannedSequenceNumber": 144,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.969434c15d4e4e86c498222ae47ef46f3e050ecd96e03dcd7bec41333c63d341",
                            "breakId": "flex.wt.break.v1.bc9f5ffa0deb9d6e4c7b7665f3b54973a81ad94cc9c100901b09ed012e9fa662",
                            "timeStampOn": 1776038450967,
                            "timeStampOff": 1776040256581,
                            "sequenceNumber": 63,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776038450.967000000,
                    "lastDriverEventTime": 1776040318916,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X81NKA02802",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16667179-15",
                            "routeCode": "AX15"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776060000000,
                    "timeRemainingSecs": 19557,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1805,
                    "routeDeliveryProgress": {
                        "totalPickUps": 163,
                        "completedPickUps": 163,
                        "totalDeliveries": 163,
                        "completedDeliveries": 71,
                        "successfulDeliveries": 71,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 326,
                        "unassignedPackages": 0,
                        "completedTasks": 234,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 57,
                        "unassignedStops": 0,
                        "completedStops": 64,
                        "notStartedStops": 78,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 143,
                        "completedLocations": 66,
                        "totalLocations": 146,
                        "completedMultiLocationStops": 2,
                        "totalMultiLocationStops": 3,
                        "routePackageSummary": {
                            "DELIVERED": 71,
                            "REMAINING": 92
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 10,
                    "itineraryStartTime": 1776024603067,
                    "actualRouteDepartureTime": 1776028351833
                }
            ],
            "serviceTypeName": "Standard Parcel - Large Van - Recycle",
            "routeDuration": 24094,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 7,
                    "packagesImpacted": 9
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 164,
                "completedPickUps": 163,
                "totalDeliveries": 164,
                "completedDeliveries": 71,
                "successfulDeliveries": 71,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 328,
                "unassignedPackages": 2,
                "completedTasks": 234,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 57,
                "unassignedStops": 1,
                "completedStops": 64,
                "notStartedStops": 79,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 144,
                "completedLocations": 66,
                "totalLocations": 147,
                "completedMultiLocationStops": 2,
                "totalMultiLocationStops": 3,
                "routePackageSummary": {
                    "DELIVERED": 71,
                    "REMAINING": 93
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.003534,
                "longitude": -121.757114,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 4
                    },
                    "countByState": {
                        "PAST": 4
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 0.0,
                "dangerousProductsWeightUnit": null
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": null,
            "preDispatch": false,
            "routeCreationTime": 1776011488,
            "rmsRouteId": "b530ae39-13d4-4165-a2de-625daa6543ba",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-53",
            "routeCode": "CX53",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018000000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "ecdb2998-380a-4fab-9515-bb41c1c74cb8",
                    "routeId": null,
                    "transporterId": "A2NN5JDXMG3G19",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "6c5986b9-47bb-4360-b4bc-a70bcd919543",
                            "plannedStart": 1776026266000,
                            "plannedEnd": 1776027166000,
                            "plannedSequenceNumber": 43,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.447f3edcfe5ef68b1a5d636ab327a6e796d3d2ce97de008cdc4f2974505e5bb0",
                            "plannedStart": 1776032472890,
                            "plannedEnd": 1776034272890,
                            "plannedSequenceNumber": 87,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "07ae1be8-8cce-4748-a91a-eec931fd26de",
                            "plannedStart": 1776039802000,
                            "plannedEnd": 1776040702000,
                            "plannedSequenceNumber": 129,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.bd20d6a22e5bc43ba53c7ddf9f73953ebae60eee488480e18b11daa9239510fd",
                            "plannedStart": 1776054972890,
                            "plannedEnd": 1776056772890,
                            "plannedSequenceNumber": 173,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.5cb5ceb5253740a8e9bf2f2f5e69447881139da0c57280026675acb804c79cd0",
                            "breakId": "flex.wt.break.v1.447f3edcfe5ef68b1a5d636ab327a6e796d3d2ce97de008cdc4f2974505e5bb0",
                            "timeStampOn": 1776031308195,
                            "timeStampOff": 1776033196792,
                            "sequenceNumber": 83,
                            "state": "OFF",
                            "type": "MEAL"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776031308.195000000,
                    "lastDriverEventTime": 1776040237077,
                    "lastVehicleMovementTime": 1776039705657,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "3C6MRVJG5ME562741",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-53",
                            "routeCode": "CX53"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776052800000,
                    "timeRemainingSecs": 12357,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 1888,
                    "routeDeliveryProgress": {
                        "totalPickUps": 296,
                        "completedPickUps": 296,
                        "totalDeliveries": 296,
                        "completedDeliveries": 229,
                        "successfulDeliveries": 228,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 592,
                        "unassignedPackages": 0,
                        "completedTasks": 525,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 104,
                        "unassignedStops": 0,
                        "completedStops": 137,
                        "notStartedStops": 37,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 174,
                        "completedLocations": 183,
                        "totalLocations": 237,
                        "completedMultiLocationStops": 40,
                        "totalMultiLocationStops": 52,
                        "routePackageSummary": {
                            "DELIVERED": 228,
                            "REMAINING": 67,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 20,
                    "completedStopsInLastHour": 28,
                    "itineraryStartTime": 1776015372895,
                    "actualRouteDepartureTime": 1776017210397
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 28366,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 33,
                    "packagesImpacted": 58
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 296,
                "completedPickUps": 296,
                "totalDeliveries": 296,
                "completedDeliveries": 229,
                "successfulDeliveries": 228,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 592,
                "unassignedPackages": 0,
                "completedTasks": 525,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 104,
                "unassignedStops": 0,
                "completedStops": 137,
                "notStartedStops": 37,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 174,
                "completedLocations": 183,
                "totalLocations": 237,
                "completedMultiLocationStops": 40,
                "totalMultiLocationStops": 52,
                "routePackageSummary": {
                    "DELIVERED": 228,
                    "REMAINING": 67,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.029911,
                "longitude": -121.940359,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": {
                "IN_GARAGE": {
                    "iconType": "IN_GARAGE",
                    "countByStatus": {
                        "PENDING": 1
                    },
                    "countByState": {
                        "FUTURE": 1
                    },
                    "summaryDetail": null
                },
                "ONE_CLICK_ACCESS": {
                    "iconType": "ONE_CLICK_ACCESS",
                    "countByStatus": {
                        "PENDING": 64
                    },
                    "countByState": {
                        "FUTURE": 64
                    },
                    "summaryDetail": null
                }
            },
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 5.473929228571459,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A2NN5JDXMG3G19",
            "preDispatch": false,
            "routeCreationTime": 1776006613,
            "rmsRouteId": "ef22330f-4dcc-4b6a-a017-323fc7394fb8",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16667179-13",
            "routeCode": "AX13",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776025800000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "abb67ae7-5ae4-4599-a6be-4b440cb157f2",
                    "routeId": null,
                    "transporterId": "AB6M3HZW09OY6",
                    "blockDurationInMinutes": 600,
                    "plannedBreaks": [
                        {
                            "breakId": "a7c930c9-612d-410d-b380-68c7c22f9a44",
                            "plannedStart": 1776033025000,
                            "plannedEnd": 1776033925000,
                            "plannedSequenceNumber": 36,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.2ce641cda0b5483504c1085cda7ad9e4232dba893820f2dc5dfda1fa9b049fb3",
                            "plannedStart": 1776041720302,
                            "plannedEnd": 1776043520302,
                            "plannedSequenceNumber": 89,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "7b966bc0-87cb-477a-abd7-a2adc6755c9e",
                            "plannedStart": 1776046242000,
                            "plannedEnd": 1776047142000,
                            "plannedSequenceNumber": 108,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "flex.wt.break.v1.ff6c314d06c9a6510f1085014984333069e228643d0fabc82288d69e36da32dc",
                            "plannedStart": 1776064220302,
                            "plannedEnd": 1776066020302,
                            "plannedSequenceNumber": 144,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        }
                    ],
                    "breaks": [
                        {
                            "punchId": "flex.wt.punch.v1.1138d522f36043b4dfbb9fc45b593fe5142fc1823cc0ebb8be729ddb9f8dfb5f",
                            "breakId": "flex.wt.break.v1.7df993f58b2f8357a317fe8fcac4059820d3f5dc2296104159589dd06ec16883",
                            "timeStampOn": 1776032326811,
                            "timeStampOff": 1776033228064,
                            "sequenceNumber": 21,
                            "state": "OFF",
                            "type": "REST"
                        }
                    ],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": 1776032326.811000000,
                    "lastDriverEventTime": 1776040190056,
                    "lastVehicleMovementTime": null,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "1FTBR3X86NKA02794",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16667179-13",
                            "routeCode": "AX13"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776060000000,
                    "timeRemainingSecs": 19557,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 901,
                    "routeDeliveryProgress": {
                        "totalPickUps": 157,
                        "completedPickUps": 157,
                        "totalDeliveries": 157,
                        "completedDeliveries": 76,
                        "successfulDeliveries": 76,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 314,
                        "unassignedPackages": 0,
                        "completedTasks": 233,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 62,
                        "unassignedStops": 0,
                        "completedStops": 68,
                        "notStartedStops": 69,
                        "inProgressStops": 1,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 138,
                        "completedLocations": 70,
                        "totalLocations": 145,
                        "completedMultiLocationStops": 2,
                        "totalMultiLocationStops": 7,
                        "routePackageSummary": {
                            "DELIVERED": 76,
                            "REMAINING": 81
                        }
                    },
                    "stopCompletionRate": 18,
                    "completedStopsInLastHour": 24,
                    "itineraryStartTime": 1776024620306,
                    "actualRouteDepartureTime": 1776027132002
                }
            ],
            "serviceTypeName": "Standard Parcel - Large Van - Recycle",
            "routeDuration": 24313,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 7,
                    "packagesImpacted": 7
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 159,
                "completedPickUps": 158,
                "totalDeliveries": 159,
                "completedDeliveries": 77,
                "successfulDeliveries": 76,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 318,
                "unassignedPackages": 4,
                "completedTasks": 235,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 62,
                "unassignedStops": 2,
                "completedStops": 69,
                "notStartedStops": 70,
                "inProgressStops": 1,
                "cancelledStops": 0,
                "attemptedStops": 0,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 140,
                "completedLocations": 71,
                "totalLocations": 147,
                "completedMultiLocationStops": 2,
                "totalMultiLocationStops": 7,
                "routePackageSummary": {
                    "DELIVERED": 76,
                    "UNDELIVERABLE": 1,
                    "REMAINING": 82
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 37.951747,
                "longitude": -121.71048,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 0.0,
                "dangerousProductsWeightUnit": null
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": null,
            "preDispatch": false,
            "routeCreationTime": 1776011488,
            "rmsRouteId": "629b65a4-8732-45f7-9472-86db435e5ed6",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        },
        {
            "routeId": "16666856-52",
            "routeCode": "CX52",
            "serviceAreaId": "9900c1c3-98c1-4162-b8ca-1363e2944946",
            "transporterIds": null,
            "plannedDepartureTime": 1776018900000,
            "totalStops": 0,
            "totalTasks": 0,
            "unassignedPackages": 0,
            "unassignedStops": 0,
            "localDate": [
                2026,
                4,
                12
            ],
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "transporters": [
                {
                    "itineraryId": "f4a3e550-4a69-47b9-9ec2-0ae072956b8c",
                    "routeId": null,
                    "transporterId": "A1HQ6LFCVR337O",
                    "blockDurationInMinutes": null,
                    "plannedBreaks": [
                        {
                            "breakId": "f0e0b320-50c6-45e3-88fd-a3bf468c656c",
                            "plannedStart": 1776026769000,
                            "plannedEnd": 1776027669000,
                            "plannedSequenceNumber": 44,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        },
                        {
                            "breakId": "d41c7b36-6c33-4020-b1c9-311689ca82ef",
                            "plannedStart": 1776034431000,
                            "plannedEnd": 1776036231000,
                            "plannedSequenceNumber": 89,
                            "breakType": null,
                            "type": "MEAL",
                            "minDurationInMillis": 1800000
                        },
                        {
                            "breakId": "ad441769-62fb-4e12-818c-0dd674d2987f",
                            "plannedStart": 1776042405000,
                            "plannedEnd": 1776043305000,
                            "plannedSequenceNumber": 133,
                            "breakType": null,
                            "type": "REST",
                            "minDurationInMillis": 900000
                        }
                    ],
                    "breaks": [],
                    "currentBreakStatus": "OFF",
                    "currentBreakTimeStampOn": null,
                    "lastDriverEventTime": 1776040364934,
                    "lastVehicleMovementTime": 1776039704717,
                    "routePauseEvents": [],
                    "routePauseStatus": null,
                    "routePauseDuration": null,
                    "vin": "3C6MRVJG5ME562612",
                    "projectedCompletionTime": null,
                    "associatedRoutes": [
                        {
                            "routeId": "16666856-52",
                            "routeCode": "CX52"
                        }
                    ],
                    "rescueActions": [],
                    "weatherData": null,
                    "itineraryStatus": "DEPARTED",
                    "stateOfChargeRemainingPercent": null,
                    "stateOfChargeRemainingPercentUpdatedAt": null,
                    "chargeToItineraryCompletion": null,
                    "chargeToStation": null,
                    "evRiskInvolved": "NOT_APPLICABLE",
                    "driverSessionEnded": false,
                    "scheduleEndTime": 1776053700000,
                    "timeRemainingSecs": 13257,
                    "itineraryPartners": null,
                    "companyId": null,
                    "totalBreaksDurationSecs": 0,
                    "routeDeliveryProgress": {
                        "totalPickUps": 307,
                        "completedPickUps": 307,
                        "totalDeliveries": 307,
                        "completedDeliveries": 212,
                        "successfulDeliveries": 211,
                        "onRoadPickups": 0,
                        "completedOnRoadPickups": 0,
                        "totalTasks": 614,
                        "unassignedPackages": 0,
                        "completedTasks": 519,
                        "packagesReattemptable": 0,
                        "plannedCompletedStops": 109,
                        "unassignedStops": 0,
                        "completedStops": 126,
                        "notStartedStops": 59,
                        "inProgressStops": 0,
                        "cancelledStops": 0,
                        "attemptedStops": 0,
                        "actionedTimeWindowedStops": 0,
                        "totalTimeWindowedStops": 0,
                        "totalStops": 185,
                        "completedLocations": 176,
                        "totalLocations": 253,
                        "completedMultiLocationStops": 39,
                        "totalMultiLocationStops": 55,
                        "routePackageSummary": {
                            "DELIVERED": 211,
                            "REMAINING": 95,
                            "PICKUP_FAILED": 1
                        }
                    },
                    "stopCompletionRate": 19,
                    "completedStopsInLastHour": 23,
                    "itineraryStartTime": 1776015374062,
                    "actualRouteDepartureTime": 1776018183018
                }
            ],
            "serviceTypeName": "Standard Parcel - Extra Large Van - US",
            "routeDuration": 27821,
            "isScheduledDeliveryAtRisk": false,
            "stopsAndPackagesByTaskAssessment": {
                "AHEAD": {
                    "stopsImpacted": 16,
                    "packagesImpacted": 25
                }
            },
            "riskFlaggingOutcome": null,
            "packageSummary": null,
            "routeDeliveryProgress": {
                "totalPickUps": 307,
                "completedPickUps": 307,
                "totalDeliveries": 307,
                "completedDeliveries": 212,
                "successfulDeliveries": 211,
                "onRoadPickups": 0,
                "completedOnRoadPickups": 0,
                "totalTasks": 614,
                "unassignedPackages": 0,
                "completedTasks": 519,
                "packagesReattemptable": 0,
                "plannedCompletedStops": 109,
                "unassignedStops": 0,
                "completedStops": 125,
                "notStartedStops": 59,
                "inProgressStops": 0,
                "cancelledStops": 0,
                "attemptedStops": 1,
                "actionedTimeWindowedStops": 0,
                "totalTimeWindowedStops": 0,
                "totalStops": 185,
                "completedLocations": 176,
                "totalLocations": 253,
                "completedMultiLocationStops": 39,
                "totalMultiLocationStops": 55,
                "routePackageSummary": {
                    "DELIVERED": 211,
                    "REMAINING": 95,
                    "PICKUP_FAILED": 1
                }
            },
            "swaInjection": null,
            "centroid": {
                "latitude": 38.019993,
                "longitude": -121.935979,
                "scope": null
            },
            "routeStatus": "DEPARTED",
            "progressStatus": "AHEAD",
            "routeLabels": [
                "DELIVERY_ONLY"
            ],
            "summaryIconsByIconType": null,
            "vasAttributes": {
                "containsVasStops": false,
                "totalVasStops": 0,
                "completedVasStops": 0
            },
            "customerReturnAttributes": {
                "totalCustomerReturnStops": 0,
                "completedCustomerReturnStops": 0
            },
            "scheduledDeliveryAttributes": {
                "totalScheduledDeliveryStops": 0,
                "actionedScheduledDeliveryStops": 0
            },
            "dangerousProductsAttributes": {
                "dangerousProductsWeight": 10.626281037311099,
                "dangerousProductsWeightUnit": "lb"
            },
            "lateDeparting": false,
            "timeWindowsCounts": [],
            "transporterIdFromRms": "A1HQ6LFCVR337O",
            "preDispatch": false,
            "routeCreationTime": 1776006616,
            "rmsRouteId": "9fe6f814-47a7-4349-bff4-c4bc5b620c68",
            "duomoCorrelationIds": null,
            "sequenceEditInfo": null,
            "swaroute": false
        }
    ],
    "transporters": [
        {
            "transporterId": "A1CXOF6XEGABI0",
            "firstName": "Jake",
            "lastName": "Hope",
            "initials": "JH",
            "workPhoneNumber": "+19257836222",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A3LEMQU65KHSAE",
            "firstName": "Sean",
            "lastName": "Dolan",
            "initials": "SD",
            "workPhoneNumber": "+19255381977",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "ALR5H070EUJ55",
            "firstName": "Diana",
            "lastName": "Gildo Ruvalcaba",
            "initials": "DG",
            "workPhoneNumber": "+19254360200",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "AEVO2MM3AMB4Q",
            "firstName": "Amaury",
            "lastName": "Cedillo",
            "initials": "AC",
            "workPhoneNumber": "+19255381980",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1VKNOXZ9UEBDN",
            "firstName": "Benjamin",
            "lastName": "Gallardo",
            "initials": "BG",
            "workPhoneNumber": "+19257837234",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A3K43EXQE4MOZQ",
            "firstName": "Mohammad Shakib",
            "lastName": "Rahmani",
            "initials": "MR",
            "workPhoneNumber": "+19255381952",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A7I3A1KHUWAFO",
            "firstName": "Michael",
            "lastName": "Jones",
            "initials": "MJ",
            "workPhoneNumber": "+19255033460",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1NF16IEME1QL9",
            "firstName": "Nicholas",
            "lastName": "Cora",
            "initials": "NC",
            "workPhoneNumber": "+19255381964",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A3FMNL9Y6KDN8Y",
            "firstName": "Rina rose",
            "lastName": "Flores",
            "initials": "RF",
            "workPhoneNumber": "+19255381939",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A289JG6MS84PU",
            "firstName": "Octavio",
            "lastName": "Navarrete Infante",
            "initials": "ON",
            "workPhoneNumber": "+19253036614",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A2NN5JDXMG3G19",
            "firstName": "Francisco",
            "lastName": "Begines  Perez",
            "initials": "FB",
            "workPhoneNumber": "+19254288909",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1F8ORSCLI2D9Y",
            "firstName": "Angel",
            "lastName": "Torres",
            "initials": "AT",
            "workPhoneNumber": "+19257837458",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A2RX2JF9ME6N83",
            "firstName": "Guillermo",
            "lastName": "Jimenez",
            "initials": "GJ",
            "workPhoneNumber": "+19255381930",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A3LST21WHOWCNV",
            "firstName": "Saul",
            "lastName": "Sanchez",
            "initials": "SS",
            "workPhoneNumber": "+19255381992",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A36NKWFXMN0GKA",
            "firstName": "John",
            "lastName": "Lafferty",
            "initials": "JL",
            "workPhoneNumber": "+19257836269",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A10DSFXFJK261W",
            "firstName": "Efrain",
            "lastName": "Murillo",
            "initials": "EM",
            "workPhoneNumber": "+19255381998",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1HOCU7X2G5B6F",
            "firstName": "Angel",
            "lastName": "Huerta Villacana",
            "initials": "AH",
            "workPhoneNumber": "+19255381961",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A32IQZOM46IZF7",
            "firstName": "Jesse",
            "lastName": "Hernandez",
            "initials": "JH",
            "workPhoneNumber": "+19255381995",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "AB06077WGSV8G",
            "firstName": "Rocky",
            "lastName": "Boon",
            "initials": "RB",
            "workPhoneNumber": "+19255381984",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A2TBJQ2EO8483T",
            "firstName": "Jose",
            "lastName": "Nunez",
            "initials": "JN",
            "workPhoneNumber": "+19257837582",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A2JLWPZYNNAXRK",
            "firstName": "Bryan",
            "lastName": "Ruiz",
            "initials": "BR",
            "workPhoneNumber": "+19257830742",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "AP6ZG0T4OHDTB",
            "firstName": "Anthony",
            "lastName": "Townes",
            "initials": "AT",
            "workPhoneNumber": "+19257837357",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1LS4EWB49P78R",
            "firstName": "Justin",
            "lastName": "Medenilla",
            "initials": "JM",
            "workPhoneNumber": "+19255380925",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1HQ6LFCVR337O",
            "firstName": "Rick",
            "lastName": "Villones",
            "initials": "RV",
            "workPhoneNumber": "+19257837649",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A1B9PIDLCF2H9K",
            "firstName": "Aliyah",
            "lastName": "Stamps",
            "initials": "AS",
            "workPhoneNumber": "+19257837963",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "AMZXF6V3XY1WV",
            "firstName": "Nicholas",
            "lastName": "Marshall",
            "initials": "NM",
            "workPhoneNumber": "+19255381923",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "A22F5H642QP4A9",
            "firstName": "Javier",
            "lastName": "Rodriguez",
            "initials": "JR",
            "workPhoneNumber": "+19255381954",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        },
        {
            "transporterId": "AB6M3HZW09OY6",
            "firstName": "Matthew",
            "lastName": "Ramirez Siletsky",
            "initials": "MR",
            "workPhoneNumber": "+19256280673",
            "personType": [
                "DA"
            ],
            "lastLocation": null
        }
    ],
    "companies": [
        {
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyName": "SYMX Logistics",
            "companyType": "DSP",
            "companyShortCode": "SYMX",
            "id": "87ca96fb-d03f-4c69-9666-5f9a54dca730"
        }
    ],
    "transporterPackageSummaries": [
        {
            "transporterId": "AP6ZG0T4OHDTB",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 223,
                "REMAINING": 86,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A2JLWPZYNNAXRK",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 170,
                "REMAINING": 116,
                "PICKUP_FAILED": 1,
                "MISSING": 1
            }
        },
        {
            "transporterId": "AB06077WGSV8G",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 35,
                "REMAINING": 0
            }
        },
        {
            "transporterId": "AB06077WGSV8G",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 27,
                "REMAINING": 0,
                "REATTEMPTABLE": 1
            }
        },
        {
            "transporterId": "A1LS4EWB49P78R",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 224,
                "REMAINING": 112,
                "PICKUP_FAILED": 1,
                "MISSING": 1,
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A7I3A1KHUWAFO",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 131,
                "REMAINING": 139,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A2RX2JF9ME6N83",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 224,
                "REMAINING": 82,
                "PICKUP_FAILED": 2
            }
        },
        {
            "transporterId": "A1CXOF6XEGABI0",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 224,
                "REMAINING": 81
            }
        },
        {
            "transporterId": "A1NF16IEME1QL9",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 243,
                "REMAINING": 76,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "REMAINING": 1
            }
        },
        {
            "transporterId": "ALR5H070EUJ55",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 249,
                "REMAINING": 58,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A3LEMQU65KHSAE",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 231,
                "REMAINING": 75,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "A2TBJQ2EO8483T",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 240,
                "REMAINING": 45
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A1B9PIDLCF2H9K",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 248,
                "REMAINING": 72
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "AMZXF6V3XY1WV",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 239,
                "REMAINING": 73,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A1F8ORSCLI2D9Y",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 258,
                "REMAINING": 64,
                "PICKUP_FAILED": 5,
                "REATTEMPTABLE": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A22F5H642QP4A9",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 71,
                "REMAINING": 75
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "REMAINING": 2,
                "UNDELIVERABLE": 2
            }
        },
        {
            "transporterId": "AEVO2MM3AMB4Q",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 245,
                "REMAINING": 72,
                "PICKUP_FAILED": 2
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 2
            }
        },
        {
            "transporterId": "A3FMNL9Y6KDN8Y",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 264,
                "REMAINING": 59,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "A1VKNOXZ9UEBDN",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 197,
                "REMAINING": 106
            }
        },
        {
            "transporterId": "A10DSFXFJK261W",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 206,
                "REMAINING": 77,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "A1HOCU7X2G5B6F",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 222,
                "REMAINING": 87,
                "PICKUP_FAILED": 2
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A36NKWFXMN0GKA",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 219,
                "REMAINING": 71,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A32IQZOM46IZF7",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 180,
                "REMAINING": 104,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "AB06077WGSV8G",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 38,
                "REMAINING": 0
            }
        },
        {
            "transporterId": "A3K43EXQE4MOZQ",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 212,
                "REMAINING": 95
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A289JG6MS84PU",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 253,
                "REMAINING": 67,
                "PICKUP_FAILED": 1,
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A3LST21WHOWCNV",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 71,
                "REMAINING": 92
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "REMAINING": 1
            }
        },
        {
            "transporterId": "A2NN5JDXMG3G19",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 228,
                "REMAINING": 67,
                "PICKUP_FAILED": 1
            }
        },
        {
            "transporterId": "AB6M3HZW09OY6",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 76,
                "REMAINING": 81
            }
        },
        {
            "transporterId": "unassigned",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "REMAINING": 1,
                "UNDELIVERABLE": 1
            }
        },
        {
            "transporterId": "A1HQ6LFCVR337O",
            "companyId": "87ca96fb-d03f-4c69-9666-5f9a54dca730",
            "companyType": "DSP",
            "packageStatus": {
                "DELIVERED": 211,
                "REMAINING": 95,
                "PICKUP_FAILED": 1
            }
        }
    ],
    "workHourAnomalies": [],
    "backendTime": 1776040442683
}

