@IsTest
private class DibaOrderCodesTest {
    private class Transformer implements HttpCalloutMock {
        public Integer calls = 0;
        public String lastBody;
        public Integer status = 200;

        public HttpResponse respond(HttpRequest request) {
            calls++;
            lastBody = request.getBody();
            HttpResponse response = new HttpResponse();
            response.setStatusCode(status);
            response.setBody(
                '<multipleOrderCodeLightResponse><orderCodeResponses>' +
                    '<orderCodeResponse><errorCode>0</errorCode><requestedOrderCode>CODE-1</requestedOrderCode>' +
                    '<responseOrderCode>NEW-1</responseOrderCode></orderCodeResponse>' +
                    '<orderCodeResponse><errorCode>0</errorCode><requestedOrderCode>CODE-2</requestedOrderCode></orderCodeResponse>' +
                    '<orderCodeResponse><errorCode>10</errorCode><requestedOrderCode>CODE-3</requestedOrderCode></orderCodeResponse>' +
                    '</orderCodeResponses></multipleOrderCodeLightResponse>'
            );
            return response;
        }
    }

    private static void deliver(List<String> codes) {
        List<Object> rows = new List<Object>();
        for (Integer i = 0; i < codes.size(); i++) {
            rows.add(
                new Map<String, Object>{
                    'tag' => new Map<String, Object>{
                        'Id' => 'a0X7Q00000TD0' +
                        i +
                        'UAAV',
                        'Name' => 'T' + i
                    },
                    'asset' => new Map<String, Object>{
                        'Id' => '02i7Q00000TD0' +
                        i +
                        'UAAV',
                        'Order_Code__c' => codes[i]
                    }
                }
            );
        }
        DibaImport.accept(
            JSON.serialize(
                new Map<String, Object>{
                    'transmission' => new Map<String, Object>{
                        'id' => 'T-OC',
                        'part' => 1,
                        'partCount' => 1
                    },
                    'account' => new Map<String, Object>{
                        'Id' => '0017Q00000TsTdAQAV',
                        'Name' => 'Nord'
                    },
                    'location' => new List<Object>{
                        new Map<String, Object>{
                            'Id' => '1317Q00000TA00UAAV',
                            'Name' => 'Hall',
                            'rows' => rows
                        }
                    }
                }
            )
        );
    }

    @IsTest
    static void readsTheAnswerOfTheService() {
        Map<String, String> results = DibaOrderCodes.parse(
            '<r><orderCodeResponses><orderCodeResponse><errorCode>0</errorCode><requestedOrderCode> A </requestedOrderCode>' +
            '<responseOrderCode>B</responseOrderCode></orderCodeResponse></orderCodeResponses></r>'
        );
        Assert.areEqual('B', results.get('A'));
        Assert.isTrue(
            DibaOrderCodes.requestXml(new List<String>{ 'A&B' })
                .contains('<orderCode>A&amp;B</orderCode>')
        );
    }

    @IsTest
    static void aDeliveryLooksUpTheSuccessors() {
        Transformer transformer = new Transformer();
        Test.setMock(HttpCalloutMock.class, transformer);
        Test.startTest();
        deliver(new List<String>{ 'CODE-1', 'CODE-2', 'CODE-3' });
        Assert.areEqual(3, [SELECT COUNT() FROM DIBA_Row__c WHERE Order_Code_Pending__c = TRUE]);
        Test.stopTest();

        Assert.areEqual(1, transformer.calls);
        Map<String, DIBA_Row__c> byCode = new Map<String, DIBA_Row__c>();
        for (DIBA_Row__c row : [
            SELECT
                Device_Ordercode__c,
                Add_Ordercode_Transform__c,
                Add_Recomend_Ordercode__c,
                Order_Code_Pending__c,
                Version__c
            FROM DIBA_Row__c
        ]) {
            byCode.put(row.Device_Ordercode__c, row);
            Assert.isFalse(row.Order_Code_Pending__c);
        }
        Assert.areEqual('NEW-1', byCode.get('CODE-1').Add_Ordercode_Transform__c);
        Assert.areEqual('NEW-1', byCode.get('CODE-1').Add_Recomend_Ordercode__c);
        Assert.areEqual(1, byCode.get('CODE-1').Version__c);
        Assert.areEqual(
            DibaOrderCodes.NO_SUCCESSOR,
            byCode.get('CODE-2').Add_Ordercode_Transform__c
        );
        Assert.isNull(
            byCode.get('CODE-3').Add_Ordercode_Transform__c,
            'error code 10 changes nothing'
        );
    }

    @IsTest
    static void aFailingServiceLeavesTheRowsPending() {
        Transformer transformer = new Transformer();
        transformer.status = 503;
        Test.setMock(HttpCalloutMock.class, transformer);
        Test.startTest();
        deliver(new List<String>{ 'CODE-1' });
        Test.stopTest();
        Assert.areEqual(1, [SELECT COUNT() FROM DIBA_Row__c WHERE Order_Code_Pending__c = TRUE]);
    }

    @IsTest
    static void theEditedOrderCodeCountsWhileItApplies() {
        Test.setMock(HttpCalloutMock.class, new Transformer());
        deliver(new List<String>{ 'OLD' });
        DIBA_Row__c row = [SELECT Id, Row_Key__c FROM DIBA_Row__c];
        insert new DIBA_Master_Edit__c(
            DIBA_Row__c = row.Id,
            Edit_Key__c = row.Row_Key__c + '/device_ordercode',
            Field__c = 'device_ordercode',
            Value__c = 'CODE-1',
            Salesforce_Value__c = 'OLD'
        );
        Test.startTest();
        DibaOrderCodeJob.run([SELECT DIBA_Account__c FROM DIBA_Row__c].DIBA_Account__c);
        Test.stopTest();
        Assert.areEqual(
            'NEW-1',
            [SELECT Add_Ordercode_Transform__c FROM DIBA_Row__c].Add_Ordercode_Transform__c
        );
    }

    @IsTest
    static void looksUpOneRowFromTheTable() {
        Test.setMock(HttpCalloutMock.class, new Transformer());
        deliver(new List<String>{ 'CODE-1' });
        Id rowId = [SELECT Id FROM DIBA_Row__c].Id;
        Test.startTest();
        Map<String, Object> row = DibaAccountController.lookupOrderCode(rowId);
        Test.stopTest();
        Assert.areEqual('NEW-1', row.get('add_ordercode_transform'));
        Assert.areEqual(false, row.get('order_code_pending'));
    }
}
