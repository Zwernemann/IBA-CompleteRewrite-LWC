@IsTest
private class DibaAccountControllerTest {
    private static final String ACCOUNT_ID = '0017Q00000TsTdAQAV';

    @TestSetup
    static void deliverAccount() {
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

    private static Id accountDataId() {
        return [SELECT Id FROM DIBA_Account__c].Id;
    }

    private static Map<String, Object> firstRow() {
        return DibaAccountController.getRows(accountDataId(), null, null).rows[0];
    }

    @IsTest
    static void findsTheDataOfTheAccountByItsKey() {
        // The delivery used a 18-character id; the account id of the button is the same.
        DibaAccountController.AccountData data = DibaAccountController.getAccountData(ACCOUNT_ID);
        Assert.areEqual('DIBA Testanlage Nord', data.name);
        Assert.areEqual(3, data.rowCount);
        Assert.areEqual(ACCOUNT_ID, data.accountKey);
        Assert.isNotNull(data.lastDelivery);
    }

    @IsTest
    static void findsTheDataOfARealAccountThroughItsLookup() {
        Account account = new Account(Name = 'Chemiewerk Sued GmbH');
        insert account;
        DIBA_Account__c record = [SELECT Id FROM DIBA_Account__c];
        record.Account__c = account.Id;
        update record;
        Assert.areEqual(record.Id, DibaAccountController.getAccountData(account.Id).recordId);
    }

    @IsTest
    static void answersNullForAnAccountWithoutDelivery() {
        Account account = new Account(Name = 'Ohne Lieferung');
        insert account;
        Assert.isNull(DibaAccountController.getAccountData(account.Id));
    }

    @IsTest
    static void pagesThroughRowsByKey() {
        DibaAccountController.Page first = DibaAccountController.getRows(accountDataId(), null, 2);
        Assert.areEqual(2, first.rows.size());
        Assert.isNotNull(first.nextAfter);

        DibaAccountController.Page second = DibaAccountController.getRows(
            accountDataId(),
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

        DibaAccountController.SaveResult result = DibaAccountController.saveRows(changes);

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
        DibaAccountController.saveRows(
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
        DibaAccountController.saveRows(JSON.serialize(new List<Object>{ change }));

        change.put('values', new Map<String, Object>{ 'add_remark1' => 'second' });
        DibaAccountController.SaveResult result = DibaAccountController.saveRows(
            JSON.serialize(new List<Object>{ change })
        );

        Assert.isTrue(result.saved.isEmpty());
        Assert.areEqual(1, result.conflicts.size());
        Assert.areEqual('first', result.conflicts[0].get('add_remark1'));
    }

    @IsTest
    static void masterFieldsChangeOnlyThroughEdits() {
        Map<String, Object> row = firstRow();
        DibaAccountController.SaveResult result = DibaAccountController.saveRows(
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
        DibaAccountController.SaveResult result = DibaAccountController.saveRows(
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
