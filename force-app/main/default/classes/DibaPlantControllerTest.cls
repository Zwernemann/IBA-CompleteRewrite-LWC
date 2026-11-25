@IsTest
private class DibaPlantControllerTest {
    private static final String ACCOUNT_ID = '0017Q00000TsTdAQAV';

    @TestSetup
    static void deliverPlant() {
        List<Object> rows = new List<Object>();
        for (Integer i = 1; i <= 3; i++) {
            rows.add(
                new Map<String, Object>{
                    'tag' => new Map<String, Object>{
                        'Id' => 'a0X7Q00000TD0' +
                        i +
                        'UAAV',
                        'Name' => 'TIC-' + i,
                        'FSLEH_Criticality__c' => 'High'
                    },
                    'asset' => new Map<String, Object>{
                        'Id' => '02i7Q00000TD0' +
                        i +
                        'UAAV',
                        'Order_Code__c' => 'CODE-' + i,
                        'Manufacturing_Date__c' => '2014-03-17'
                    }
                }
            );
        }
        DibaImport.accept(
            JSON.serialize(
                new Map<String, Object>{
                    'transmission' => new Map<String, Object>{
                        'id' => 'T-1',
                        'part' => 1,
                        'partCount' => 1
                    },
                    'account' => new Map<String, Object>{
                        'Id' => ACCOUNT_ID,
                        'Name' => 'DIBA Testanlage Nord'
                    },
                    'location' => new List<Object>{
                        new Map<String, Object>{
                            'Id' => '1317Q00000TA00UAAV',
                            'Name' => 'Hall A',
                            'rows' => rows
                        }
                    }
                }
            )
        );
    }

    private static Id plantId() {
        return [SELECT Id FROM DIBA_Account__c].Id;
    }

    private static Map<String, Object> firstRow() {
        return DibaPlantController.getRows(plantId(), null, null).rows[0];
    }

    @IsTest
    static void listsPlantsWithRowCount() {
        List<DibaPlantController.Plant> plants = DibaPlantController.listPlants();
        Assert.areEqual(1, plants.size());
        Assert.areEqual('DIBA Testanlage Nord', plants[0].name);
        Assert.areEqual(3, plants[0].rowCount);
        Assert.areEqual(ACCOUNT_ID, plants[0].accountKey);
        Assert.isNotNull(plants[0].lastDelivery);
    }

    @IsTest
    static void pagesThroughRowsByKey() {
        DibaPlantController.Page first = DibaPlantController.getRows(plantId(), null, 2);
        Assert.areEqual(2, first.rows.size());
        Assert.isNotNull(first.nextAfter);

        DibaPlantController.Page second = DibaPlantController.getRows(
            plantId(),
            first.nextAfter,
            2
        );
        Assert.areEqual(1, second.rows.size());
        Assert.isNull(second.nextAfter, 'last page');

        Map<String, Object> row = first.rows[0];
        Assert.areEqual('TIC-1', row.get('device_tag'));
        Assert.areEqual('high', row.get('device_criticality'));
        Assert.areEqual('2014-03-17', row.get('device_manufacturingdate'), 'dates as text');
        Assert.areEqual(0, row.get('version'));
        Assert.isNotNull(row.get('device_oid'));
        Assert.areEqual(0, ((List<Object>) row.get('edits')).size());
    }

    @IsTest
    static void savesConsultantInputAndMasterEdits() {
        Map<String, Object> row = firstRow();
        String changes = JSON.serialize(
            new List<Object>{
                new Map<String, Object>{
                    'id' => row.get('id'),
                    'version' => 0,
                    'values' => new Map<String, Object>{
                        'add_remark1' => 'Checked',
                        'add_nu_price' => '12.50',
                        'device_riskofmaint' => 'high'
                    },
                    'edits' => new List<Object>{
                        new Map<String, Object>{
                            'field' => 'device_ordercode',
                            'value' => 'NEW-1',
                            'salesforceValue' => 'CODE-1'
                        }
                    }
                }
            }
        );

        DibaPlantController.SaveResult result = DibaPlantController.saveRows(changes);

        Assert.areEqual(1, result.saved.get((Id) row.get('id')));
        Assert.isTrue(result.conflicts.isEmpty());
        Map<String, Object> after = firstRow();
        Assert.areEqual('Checked', after.get('add_remark1'));
        Assert.areEqual(12.5, (Decimal) after.get('add_nu_price'));
        Assert.areEqual('high', after.get('device_riskofmaint'));
        Assert.areEqual('CODE-1', after.get('device_ordercode'), 'the Salesforce value stays');
        List<Object> edits = (List<Object>) after.get('edits');
        Assert.areEqual(1, edits.size());
        Assert.areEqual('NEW-1', ((Map<String, Object>) edits[0]).get('value'));
        Assert.areEqual(1, after.get('version'));

        // Taking the edit back removes it.
        DibaPlantController.saveRows(
            JSON.serialize(
                new List<Object>{
                    new Map<String, Object>{
                        'id' => row.get('id'),
                        'version' => 1,
                        'edits' => new List<Object>{
                            new Map<String, Object>{
                                'field' => 'device_ordercode',
                                'value' => null
                            }
                        }
                    }
                }
            )
        );
        Assert.areEqual(0, [SELECT COUNT() FROM DIBA_Master_Edit__c]);
    }

    @IsTest
    static void staleVersionComesBackAsConflict() {
        Map<String, Object> row = firstRow();
        Map<String, Object> change = new Map<String, Object>{
            'id' => row.get('id'),
            'version' => 0,
            'values' => new Map<String, Object>{ 'add_remark1' => 'first' }
        };
        DibaPlantController.saveRows(JSON.serialize(new List<Object>{ change }));

        change.put('values', new Map<String, Object>{ 'add_remark1' => 'second' });
        DibaPlantController.SaveResult result = DibaPlantController.saveRows(
            JSON.serialize(new List<Object>{ change })
        );

        Assert.isTrue(result.saved.isEmpty());
        Assert.areEqual(1, result.conflicts.size());
        Assert.areEqual('first', result.conflicts[0].get('add_remark1'));
    }

    @IsTest
    static void masterFieldsChangeOnlyThroughEdits() {
        Map<String, Object> row = firstRow();
        DibaPlantController.SaveResult result = DibaPlantController.saveRows(
            JSON.serialize(
                new List<Object>{
                    new Map<String, Object>{
                        'id' => row.get('id'),
                        'version' => 0,
                        'values' => new Map<String, Object>{ 'device_ordercode' => 'X' }
                    }
                }
            )
        );
        Assert.isTrue(result.saved.isEmpty());
        Assert.isTrue(result.errors.get((Id) row.get('id')).contains('device_ordercode'));
    }

    @IsTest
    static void tooLongValueIsRejected() {
        Map<String, Object> row = firstRow();
        DibaPlantController.SaveResult result = DibaPlantController.saveRows(
            JSON.serialize(
                new List<Object>{
                    new Map<String, Object>{
                        'id' => row.get('id'),
                        'version' => 0,
                        'values' => new Map<String, Object>{
                            'reco_insp_interval' => 'x'.repeat(40)
                        }
                    }
                }
            )
        );
        Assert.isTrue(result.errors.get((Id) row.get('id')).contains('limited to 32'));
    }
}
