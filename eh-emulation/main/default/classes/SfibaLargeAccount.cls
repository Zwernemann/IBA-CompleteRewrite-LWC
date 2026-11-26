/**
 * An invented account of any size for load tests, delivered through mzw.SfibaImport in parts
 * of PART_SIZE rows, one batch execution per part (SfibaLargeAccountBatch). A chain of
 * Queueables, one starting the next, ended after five in a Developer Edition ("Maximum stack
 * depth has been reached"); a batch has no such depth. The class stays a Queueable: a global
 * class keeps its interfaces once released. As scripts/lib/MassData.java of IBA-Salesforce:
 * five accounts with six halls and four lines each, device families with the SPK codes of the
 * interval table, Endress+Hauser for about half of the devices, twenty invented
 * manufacturers. Every value follows from the row number, so a second run replaces the
 * rows instead of doubling them. Only for test orgs.
 *
 *   mzw.SfibaLargeAccount.start(null, 50000);   anonymous Apex; the fixed load test account
 */
global with sharing class SfibaLargeAccount implements Queueable {
    public static final Integer PART_SIZE = 1000;
    public static final String ACCOUNT_ID = '001LT0000000001AAA';

    private static final List<List<String>> FAMILIES = new List<List<String>>{
        // parameter type, tag prefix, SPK, device type, product
        new List<String>{ 'Flow', 'FI', 'DA', 'Flow, Electro-Magnetic', 'Promag W 400' },
        new List<String>{ 'Flow', 'FI', 'DB', 'Flow, Vortex', 'Prowirl F 200' },
        new List<String>{ 'Flow', 'FI', 'DD', 'Flow, Coriolis', 'Promass F 300' },
        new List<String>{ 'Length', 'LI', 'FL', 'Level, Radar', 'Micropilot FMR51' },
        new List<String>{ 'Length', 'LI', 'FH', 'Level, Guided Radar', 'Levelflex FMP51' },
        new List<String>{ 'Length', 'LI', 'FQ', 'Level, Vibronic Liquid', 'Liquiphant FTL51' },
        new List<String>{ 'Pressure', 'PI', 'PA', 'Pressure, Process', 'Cerabar PMP71' },
        new List<String>{ 'Pressure', 'PI', 'PD', 'Pressure, Differential', 'Deltabar PMD75' },
        new List<String>{ 'Temperature', 'TI', 'TM', 'Temperature, Transmitter', 'iTEMP TMT82' },
        new List<String>{ 'Temperature', 'TI', 'TA', 'Temperature, Resistor RTD', 'Omnigrad TR10' },
        new List<String>{ 'pH', 'QI', 'CA', 'Analysis, pH/ORPnt', 'Memosens CPS11D' },
        new List<String>{ 'Conductivity', 'QI', 'CF', 'Analysis, Conductivity', 'Condumax CLS21D' }
    };
    private static final List<String> MANUFACTURERS = new List<String>{
        'Aquatec Messtechnik',
        'Brennwald Instruments',
        'Corvana Sensorik',
        'Delmar Flow Systems',
        'Eiderhof Controls',
        'Fjordline Analytics',
        'Granitz Messgeraete',
        'Hollmark Automation',
        'Isarwerk Sensors',
        'Jadebucht Instruments',
        'Kaltenbach Prozesstechnik',
        'Lindqvist Process',
        'Moorland Metering',
        'Nordhang Technik',
        'Oderbruch Systems',
        'Pellworm Industrial',
        'Quellenstein Messtechnik',
        'Rhoenblick Controls',
        'Sylter Sensorik',
        'Talheim Automation'
    };
    private static final List<String> PLANTS = new List<String>{
        'Werk Nord',
        'Werk Sued',
        'Werk Ost',
        'Werk West',
        'Werk Mitte'
    };
    private static final List<String> HALLS = new List<String>{
        'Halle A',
        'Halle B',
        'Halle C',
        'Halle D',
        'Halle E',
        'Halle F'
    };
    private static final List<String> LINES = new List<String>{
        'Linie 1',
        'Linie 2',
        'Linie 3',
        'Linie 4'
    };
    private static final List<String> STATUS = new List<String>{
        'available',
        'available',
        'phase out',
        'order stop'
    };

    private static final List<String> ACCESSIBILITY = new List<String>{
        'Easy',
        'Moderate',
        'Difficult'
    };
    private static final List<String> EFFECTIVENESS = new List<String>{ 'Low', 'Medium', 'High' };

    private final String accountId;
    private final String accountName;
    private final Integer rows;
    private final Integer part;
    private final String transmissionId;

    private SfibaLargeAccount(
        String accountId,
        String accountName,
        Integer rows,
        Integer part,
        String transmissionId
    ) {
        this.accountId = accountId;
        this.accountName = accountName;
        this.rows = rows;
        this.part = part;
        this.transmissionId = transmissionId;
    }

    /**
     * Starts the delivery; the parts follow one after another in a batch, one part each.
     *
     * @param accountId an account of the org, or null for the fixed load test account
     * @param rows      number of rows
     * @return the transmission id, to follow the delivery in SFIBA_Transmission__c
     */
    global static String start(Id accountId, Integer rows) {
        String id = ACCOUNT_ID;
        String name = 'DIBA Lasttest';
        if (accountId != null) {
            Account account = [SELECT Id, Name FROM Account WHERE Id = :accountId];
            id = account.Id;
            name = account.Name;
        }
        String transmissionId = 'LASTTEST-' + System.now().getTime();
        // A test may run one batch execution only: there, the first part alone.
        Integer parts = Test.isRunningTest() ? 1 : partCount(rows);
        Database.executeBatch(new SfibaLargeAccountBatch(id, name, rows, parts, transmissionId), 1);
        return transmissionId;
    }

    /** One part, as a Queueable; no longer started by start(), kept for the interface. */
    public void execute(QueueableContext context) {
        SfibaImport.accept(build(accountId, accountName, rows, part, transmissionId));
    }

    public static Integer partCount(Integer rows) {
        return (rows + PART_SIZE - 1) / PART_SIZE;
    }

    /** One part as JSON in schema v3. */
    public static String build(
        String accountId,
        String accountName,
        Integer rows,
        Integer part,
        String transmissionId
    ) {
        Integer first = (part - 1) * PART_SIZE;
        Integer last = Math.min(rows, first + PART_SIZE);
        List<Object> located = new List<Object>();
        List<Object> unassigned = new List<Object>();
        for (Integer row = first; row < last; row++) {
            Map<String, Object> asset = asset(row);
            // One percent of the assets have no measuring point.
            if (Math.mod(row, 100) == 99) {
                unassigned.add(asset);
            } else {
                located.add(new Map<String, Object>{ 'tag' => tag(row), 'asset' => asset });
            }
        }
        return JSON.serialize(
            new Map<String, Object>{
                'transmission' => new Map<String, Object>{
                    'id' => transmissionId,
                    'part' => part,
                    'partCount' => partCount(rows),
                    'language' => 'en_US',
                    'isFinalReport' => false
                },
                'account' => new Map<String, Object>{ 'Id' => accountId, 'Name' => accountName },
                'location' => new List<Object>{
                    new Map<String, Object>{
                        'Id' => '131LT0000000001AAA',
                        'Name' => 'DIBA Lasttest',
                        'ParentLocationId' => null,
                        'LocationLevel' => 1,
                        'rows' => located
                    }
                },
                'unassignedAssets' => unassigned
            }
        );
    }

    /** A number from 0 to bound - 1 that depends only on row and salt. */
    @TestVisible
    private static Integer pick(Integer row, Integer salt, Integer bound) {
        Long r = row;
        Long s = salt;
        Long value = Math.mod(r * 2654435761L + s * 40503L, 4294967296L);
        Long b = bound;
        return Math.mod(value / 7, b).intValue();
    }

    private static List<String> family(Integer row) {
        return FAMILIES[pick(row, 1, FAMILIES.size())];
    }

    private static Boolean endressHauser(Integer row) {
        return pick(row, 2, 100) < 50;
    }

    private static Map<String, Object> tag(Integer row) {
        List<String> family = family(row);
        Integer line = pick(row, 3, PLANTS.size() * HALLS.size() * LINES.size());
        String location =
            PLANTS[line / (HALLS.size() * LINES.size())] +
            ', ' +
            HALLS[Math.mod(line / LINES.size(), HALLS.size())] +
            ', ' +
            LINES[Math.mod(line, LINES.size())];
        Integer criticality = pick(row, 4, 100);
        return new Map<String, Object>{
            'Id' => id('a4wLT', row),
            'Name' => family[1] +
            '-' +
            (10000 + row),
            'FSLEH_ParameterType__c' => family[0],
            'FSLEH_Criticality__c' => criticality < 35
                ? 'Low'
                : criticality < 80 ? 'Medium' : 'High',
            'FSLEH_Location_Name__c' => location,
            'FSLEH_Accessibility__c' => ACCESSIBILITY[pick(row, 5, 3)],
            'FSLEH_Maintenance_effectiveness__c' => EFFECTIVENESS[pick(row, 6, 3)],
            'FSLEH_Environmental_Conditions__c' => pick(row, 7, 100) < 80 ? 'Normal' : 'Heavy',
            'FSLEH_Special_Demands__c' => pick(row, 8, 100) < 15 ? 'Yes' : 'No',
            'FSLEH_Environmental_Relevant__c' => pick(row, 9, 100) < 20 ? 'Yes' : 'No',
            'FSLEH_Safety_Relevant__c' => pick(row, 10, 100) < 25 ? 'Yes' : 'No',
            'FSLEH_Quality_Relevant__c' => pick(row, 11, 100) < 30 ? 'Yes' : 'No'
        };
    }

    private static Map<String, Object> asset(Integer row) {
        List<String> family = family(row);
        Boolean eh = endressHauser(row);
        Integer year = 1995 + pick(row, 12, 31);
        Integer month = 1 + pick(row, 13, 12);
        Integer day = 1 + pick(row, 14, 28);
        return new Map<String, Object>{
            'Id' => id('02iLT', row),
            'Name' => eh ? family[4] : family[3] + ' ' + (100 + pick(row, 15, 900)),
            'Manufacturer_List__c' => eh
                ? 'Endress+Hauser'
                : MANUFACTURERS[pick(row, 16, MANUFACTURERS.size())],
            'Order_Code__c' => family[2] +
            (1000 + pick(row, 17, 40)) +
            '-A' +
            pick(row, 18, 9),
            'SerialNumber' => 'S' + String.valueOf(100000000 + row),
            'Device_Type2__c' => family[2],
            'deviceTypeValue' => family[3],
            'Manufacturing_Date__c' => String.valueOf(Date.newInstance(year, month, day)),
            'FSLEH_Product_Status_Formula__c' => eh ? STATUS[pick(row, 19, STATUS.size())] : null
        };
    }

    /** An id of 18 characters from a prefix and the row number. */
    private static String id(String prefix, Integer row) {
        String digits = String.valueOf(row);
        return prefix + '0'.repeat(13 - digits.length()) + digits;
    }
}
