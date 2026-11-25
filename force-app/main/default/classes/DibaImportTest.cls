@IsTest
private class DibaImportTest {
    private static final String ACCOUNT_ID = '0017Q00000TsTdAQAV';

    // --- Building deliveries ----------------------------------------------------------

    private static Map<String, Object> tag(String id, String name) {
        return new Map<String, Object>{
            'Id' => id,
            'Name' => name,
            'FSLEH_ParameterType__c' => 'Temperature',
            'FSLEH_Location_Name__c' => null,
            'FSLEH_Criticality__c' => 'High',
            'FSLEH_Accessibility__c' => 'Moderate',
            'FSLEH_Maintenance_effectiveness__c' => 'Low',
            'FSLEH_Environmental_Conditions__c' => 'Heavy',
            'FSLEH_Special_Demands__c' => 'Yes',
            'FSLEH_Environmental_Relevant__c' => true,
            'FSLEH_Safety_Relevant__c' => 'No',
            'FSLEH_Quality_Relevant__c' => null
        };
    }

    private static Map<String, Object> asset(String id, String orderCode) {
        return new Map<String, Object>{
            'Id' => id,
            'Name' => 'iTEMP TMT162',
            'Manufacturer_List__c' => 'Endress+Hauser',
            'Order_Code__c' => orderCode,
            'SerialNumber' => 'M409A204G7B',
            'Device_Type2__c' => 'TM',
            'deviceTypeValue' => 'Temperature, Transmitter',
            'Manufacturing_Date__c' => '2014-03-17',
            'FSLEH_Product_Status_Formula__c' => 'phase out'
        };
    }

    private static Map<String, Object> row(Map<String, Object> tag, Map<String, Object> asset) {
        return new Map<String, Object>{ 'tag' => tag, 'asset' => asset };
    }

    private static Map<String, Object> delivery(
        String transmissionId,
        Integer part,
        Integer partCount,
        List<Object> rows,
        List<Object> unassigned
    ) {
        Map<String, Object> result = new Map<String, Object>{
            'transmission' => new Map<String, Object>{
                'id' => transmissionId,
                'part' => part,
                'partCount' => partCount,
                'sentAt' => '2026-11-25T09:00:00Z',
                'language' => 'en_US',
                'isFinalReport' => false
            },
            'account' => new Map<String, Object>{
                'Id' => ACCOUNT_ID,
                'Name' => 'DIBA Testanlage Nord',
                'BillingCountryCode' => 'DE'
            },
            'location' => new List<Object>{
                new Map<String, Object>{
                    'Id' => '1317Q00000TA00UAAV',
                    'Name' => 'Hall A',
                    'ParentLocationId' => null,
                    'LocationLevel' => 1,
                    'rows' => rows
                }
            }
        };
        if (unassigned != null) {
            result.put('unassignedAssets', unassigned);
        }
        return result;
    }

    private static Map<String, Object> twoRows(
        String transmissionId,
        Integer part,
        Integer partCount
    ) {
        return delivery(
            transmissionId,
            part,
            partCount,
            new List<Object>{
                row(
                    tag('a0X7Q00000TD01UAAV', 'TIC-1021'),
                    asset('02i7Q00000TD01UAAV', 'TMT162-A1')
                ),
                row(tag('a0X7Q00000TD02UAAV', 'FIC-2044'), asset('02i7Q00000TD02UAAV', '5W4B50-AA'))
            },
            null
        );
    }

    private static List<DIBA_Row__c> storedRows() {
        return [
            SELECT
                Name,
                Row_Key__c,
                Tag_Id__c,
                Asset_Id__c,
                Device_Tag__c,
                Device_Measuringtask__c,
                Location_Name__c,
                Device_Criticality__c,
                Device_Accessibility__c,
                Device_Maint_Effectivness__c,
                Device_Conditions__c,
                Device_Specialdemands__c,
                Device_Property_Envrelevant__c,
                Device_Property_Safetyrelevant__c,
                Device_Property_Qualityrelevant__c,
                Device_Ordercode__c,
                Device_Manufacturingdate__c,
                Devicetype_Spk__c,
                Add_Remark1__c
            FROM DIBA_Row__c
            ORDER BY Row_Key__c
        ];
    }

    // --- Tests ----------------------------------------------------------------------------

    @IsTest
    static void storesRowsAndAnswersLikeTheFormerEndpoint() {
        DibaImport.Result first = DibaImport.process(System.JSON.serialize(twoRows('T-1', 1, 2)));

        Assert.areEqual(2, first.rowsAccepted);
        Assert.isFalse(first.alreadySeen);
        Assert.isFalse(first.complete, 'one of two parts');
        Assert.areEqual(ACCOUNT_ID, first.accountId);

        List<DIBA_Row__c> rows = storedRows();
        Assert.areEqual(2, rows.size());
        DIBA_Row__c row = rows[0];
        Assert.areEqual(ACCOUNT_ID + '/a0X7Q00000TD01UAAV/02i7Q00000TD01UAAV', row.Row_Key__c);
        Assert.areEqual('TIC-1021', row.Device_Tag__c);
        Assert.areEqual('Temperature', row.Device_Measuringtask__c);
        Assert.areEqual(
            'Hall A',
            row.Location_Name__c,
            'name of the location without tag location'
        );
        Assert.areEqual('high', row.Device_Criticality__c, 'picklists in lower case');
        Assert.areEqual('moderate', row.Device_Accessibility__c);
        Assert.areEqual('low', row.Device_Maint_Effectivness__c);
        Assert.areEqual('heavy', row.Device_Conditions__c);
        Assert.isTrue(row.Device_Specialdemands__c, '"Yes"');
        Assert.isTrue(row.Device_Property_Envrelevant__c, 'true');
        Assert.isFalse(row.Device_Property_Safetyrelevant__c, '"No"');
        Assert.isFalse(row.Device_Property_Qualityrelevant__c, 'null');
        Assert.areEqual(Date.newInstance(2014, 3, 17), row.Device_Manufacturingdate__c);
        Assert.areEqual('TM', row.Devicetype_Spk__c);
        Assert.isNotNull(row.Name, 'the auto number is the device_oid of the report XML');

        DibaImport.Result second = DibaImport.process(System.JSON.serialize(twoRows('T-1', 2, 2)));
        Assert.isTrue(second.complete, 'both parts');

        DIBA_Account__c plant = [
            SELECT Name, Country_Code__c, Preset_Language__c, Preset_Final_Report__c
            FROM DIBA_Account__c
        ];
        Assert.areEqual('DIBA Testanlage Nord', plant.Name);
        Assert.areEqual('DE', plant.Country_Code__c);
        Assert.areEqual('en_US', plant.Preset_Language__c);
        Assert.areEqual('false', plant.Preset_Final_Report__c);
    }

    @IsTest
    static void answerIsJsonInTheFormerShape() {
        Map<String, Object> data = twoRows('T-2', 1, 1);

        String answer = DibaImport.accept(System.JSON.serialize(data));

        Map<String, Object> parsed = (Map<String, Object>) System.JSON.deserializeUntyped(answer);
        Assert.areEqual('T-2', parsed.get('transmissionId'));
        Assert.areEqual(1, parsed.get('part'));
        Assert.areEqual(2, parsed.get('rowsAccepted'));
        Assert.areEqual(0, parsed.get('tagsWithoutAsset'));
        Assert.areEqual(true, parsed.get('complete'));
        Assert.areEqual(false, parsed.get('alreadySeen'));
        Assert.isTrue(parsed.containsKey('openUrl'));
        Assert.isNull(parsed.get('openUrl'));
        Assert.isTrue(answer.startsWith('{"transmissionId":"T-2","part":1,"accountId":'), answer);
    }

    @IsTest
    static void samePartWithSameContentIsSeenOnce() {
        DibaImport.process(System.JSON.serialize(twoRows('T-3', 1, 1)));

        // Same content, other spacing: the content counts, not the text.
        String again = System.JSON.serializePretty(twoRows('T-3', 1, 1));
        DibaImport.Result result = DibaImport.process(again);

        Assert.isTrue(result.alreadySeen);
        Assert.areEqual(0, result.rowsAccepted);
        Assert.isTrue(result.complete);
        Assert.areEqual(1, [SELECT COUNT() FROM DIBA_Transmission__c]);
    }

    @IsTest
    static void samePartWithOtherContentIsProcessed() {
        DibaImport.process(System.JSON.serialize(twoRows('T-4', 1, 1)));
        Map<String, Object> corrected = delivery(
            'T-4',
            1,
            1,
            new List<Object>{
                row(
                    tag('a0X7Q00000TD01UAAV', 'TIC-1021-NEW'),
                    asset('02i7Q00000TD01UAAV', 'TMT162-A1')
                )
            },
            null
        );

        DibaImport.Result result = DibaImport.process(System.JSON.serialize(corrected));

        Assert.isFalse(result.alreadySeen);
        Assert.areEqual(1, result.rowsAccepted);
        Assert.areEqual('TIC-1021-NEW', storedRows()[0].Device_Tag__c);
    }

    @IsTest
    static void resendOverwritesMasterDataAndKeepsConsultantInput() {
        DibaImport.process(System.JSON.serialize(twoRows('T-5', 1, 1)));
        DIBA_Row__c row = storedRows()[0];
        String deviceOid = row.Name;
        row.Add_Remark1__c = 'Checked by the consultant';
        update row;

        Map<String, Object> changed = tag('a0X7Q00000TD01UAAV', 'TIC-1021');
        changed.put('FSLEH_Criticality__c', 'Low');
        DibaImport.process(
            System.JSON.serialize(
                delivery(
                    'T-6',
                    1,
                    1,
                    new List<Object>{ row(changed, asset('02i7Q00000TD01UAAV', 'TMT162-B2')) },
                    null
                )
            )
        );

        DIBA_Row__c after = storedRows()[0];
        Assert.areEqual('low', after.Device_Criticality__c);
        Assert.areEqual('TMT162-B2', after.Device_Ordercode__c);
        Assert.areEqual('Checked by the consultant', after.Add_Remark1__c);
        Assert.areEqual(deviceOid, after.Name, 'the device_oid never changes');
        Assert.areEqual(2, storedRows().size(), 'a delivery never deletes rows');
    }

    @IsTest
    static void unknownValuesAreNamedNotRejected() {
        Map<String, Object> odd = tag('a0X7Q00000TD01UAAV', 'TIC-1021');
        odd.put('FSLEH_Criticality__c', 'Very high');
        odd.put('FSLEH_ParameterType__c', 'Level');

        DibaImport.Result result = DibaImport.process(
            System.JSON.serialize(
                delivery(
                    'T-7',
                    1,
                    1,
                    new List<Object>{ row(odd, asset('02i7Q00000TD01UAAV', null)) },
                    null
                )
            )
        );

        Assert.areEqual(
            new Set<String>{ 'Very high' },
            result.unknownValues.get('FSLEH_Criticality__c')
        );
        Assert.areEqual(
            new Set<String>{ 'Level' },
            result.unknownValues.get('FSLEH_ParameterType__c')
        );
        DIBA_Row__c row = storedRows()[0];
        Assert.isNull(row.Device_Criticality__c, 'unknown picklist value stored as not set');
        Assert.areEqual('Level', row.Device_Measuringtask__c, 'parameter type stored as sent');
    }

    @IsTest
    static void tagsWithoutAssetAreCountedAndRepetitionsDropped() {
        Map<String, Object> data = delivery(
            'T-8',
            1,
            1,
            new List<Object>{
                row(tag('a0X7Q00000TD01UAAV', 'TIC-1021'), asset('02i7Q00000TD01UAAV', 'A')),
                row(tag('a0X7Q00000TD01UAAV', 'TIC-1021'), asset('02i7Q00000TD01UAAV', 'B')),
                row(tag('a0X7Q00000TD03UAAV', 'PIC-2050'), null)
            },
            new List<Object>{
                asset('02i7Q00000TD01UAAV', 'at a tag already'),
                asset('02i7Q00000TD06UAAV', 'without tag')
            }
        );

        DibaImport.Result result = DibaImport.process(System.JSON.serialize(data));

        Assert.areEqual(1, result.tagsWithoutAsset);
        Assert.areEqual(2, result.rowsAccepted);
        List<DIBA_Row__c> rows = storedRows();
        Assert.areEqual('B', rows[1].Device_Ordercode__c, 'the later repetition wins');
        Assert.areEqual(ACCOUNT_ID + '//02i7Q00000TD06UAAV', rows[0].Row_Key__c);
        Assert.isNull(rows[0].Tag_Id__c);
    }

    @IsTest
    static void tagLocationWinsOverLocationName() {
        Map<String, Object> located = tag('a0X7Q00000TD01UAAV', 'TIC-1021');
        located.put('FSLEH_Location_Name__c', 'Plant 1, Hall A, Line 2');
        DibaImport.process(
            System.JSON.serialize(
                delivery(
                    'T-9',
                    1,
                    1,
                    new List<Object>{ row(located, asset('02i7Q00000TD01UAAV', null)) },
                    null
                )
            )
        );
        Assert.areEqual('Plant 1, Hall A, Line 2', storedRows()[0].Location_Name__c);
    }

    @IsTest
    static void presetIsKeptWhenNotSent() {
        DibaImport.process(System.JSON.serialize(twoRows('T-10', 1, 1)));
        Map<String, Object> data = twoRows('T-11', 1, 1);
        Map<String, Object> transmission = (Map<String, Object>) data.get('transmission');
        transmission.remove('language');
        transmission.remove('isFinalReport');

        DibaImport.process(System.JSON.serialize(data));

        DIBA_Account__c plant = [
            SELECT Preset_Language__c, Preset_Final_Report__c
            FROM DIBA_Account__c
        ];
        Assert.areEqual('en_US', plant.Preset_Language__c);
        Assert.areEqual('false', plant.Preset_Final_Report__c);
    }

    @IsTest
    static void existingAccountIsLinked() {
        Account account = new Account(Name = 'DIBA Testanlage Nord');
        insert account;
        Map<String, Object> data = twoRows('T-12', 1, 1);
        ((Map<String, Object>) data.get('account')).put('Id', (String) account.Id);

        DibaImport.process(System.JSON.serialize(data));

        Assert.areEqual(account.Id, [SELECT Account__c FROM DIBA_Account__c].Account__c);
    }

    @IsTest
    static void schemaViolationsAreAllNamed() {
        Map<String, Object> data = twoRows('T-13', 1, 1);
        ((Map<String, Object>) data.get('transmission')).put('part', 0);
        ((Map<String, Object>) data.get('account')).put('Id', 'not-an-id');
        data.put('rows', new List<Object>());

        try {
            DibaImport.process(System.JSON.serialize(data));
            Assert.fail('rejected expected');
        } catch (DibaImport.ImportException e) {
            String message = e.getMessage();
            Assert.isTrue(
                message.startsWith(
                    'Die gesendeten Daten entsprechen nicht dem vereinbarten Schema: '
                ),
                message
            );
            Assert.isTrue(
                message.contains('/transmission/part: must have a minimum value of 1'),
                message
            );
            Assert.isTrue(message.contains('/account/Id: does not match the pattern'), message);
            Assert.isTrue(
                message.contains('/: property \'rows\' is not defined in the schema'),
                message
            );
        }
        Assert.areEqual(0, [SELECT COUNT() FROM DIBA_Account__c], 'nothing stored');
    }

    @IsTest
    static void wrongYesNoValueRejectsTheDelivery() {
        Map<String, Object> odd = tag('a0X7Q00000TD01UAAV', 'TIC-1021');
        odd.put('FSLEH_Safety_Relevant__c', 'yes');
        Map<String, Object> data = delivery(
            'T-14',
            1,
            1,
            new List<Object>{ row(odd, asset('02i7Q00000TD01UAAV', null)) },
            null
        );
        try {
            DibaImport.process(System.JSON.serialize(data));
            Assert.fail('rejected expected');
        } catch (DibaImport.ImportException e) {
            Assert.isTrue(
                e.getMessage().contains('/location/0/rows/0/tag/FSLEH_Safety_Relevant__c'),
                e.getMessage()
            );
        }
    }

    @IsTest
    static void missingRequiredPropertiesAreNamed() {
        try {
            DibaImport.process('{"transmission": {"id": "T-15", "part": 2, "partCount": 1}}');
            Assert.fail('rejected expected');
        } catch (DibaImport.ImportException e) {
            String message = e.getMessage();
            Assert.isTrue(message.contains('/: required property \'account\' not found'), message);
            Assert.isTrue(message.contains('/: required property \'location\' not found'), message);
            Assert.isTrue(
                message.contains('/transmission/part: must not be greater than partCount'),
                message
            );
        }
    }

    @IsTest
    static void invalidJsonIsRejected() {
        try {
            DibaImport.process('{ this is not json');
            Assert.fail('rejected expected');
        } catch (DibaImport.ImportException e) {
            Assert.isTrue(
                e.getMessage().startsWith('Die gesendeten Daten sind kein gueltiges JSON: ')
            );
        }
    }

    @IsTest
    static void unreadableDateRejectsAndStoresNothing() {
        Map<String, Object> bad = asset('02i7Q00000TD01UAAV', null);
        bad.put('Manufacturing_Date__c', '2026-02-30');
        try {
            DibaImport.process(
                System.JSON.serialize(
                    delivery(
                        'T-16',
                        1,
                        1,
                        new List<Object>{ row(tag('a0X7Q00000TD01UAAV', 'TIC-1021'), bad) },
                        null
                    )
                )
            );
            Assert.fail('rejected expected');
        } catch (DibaImport.ImportException e) {
            Assert.areEqual(
                'Datum nicht lesbar in Manufacturing_Date__c: \'2026-02-30\'. Erwartet JJJJ-MM-TT.',
                e.getMessage()
            );
        }
        Assert.areEqual(0, [SELECT COUNT() FROM DIBA_Row__c]);
    }

    @IsTest
    static void dateParsing() {
        Assert.areEqual(Date.newInstance(2024, 2, 29), DibaImportPayload.toDate('2024-02-29'));
        Assert.isNull(DibaImportPayload.toDate(''));
        try {
            DibaImportPayload.toDate('17.03.2014');
            Assert.fail('rejected expected');
        } catch (DibaImport.ImportException e) {
            Assert.isTrue(e.getMessage().contains('17.03.2014'));
        }
    }
}
