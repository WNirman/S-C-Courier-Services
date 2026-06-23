CREATE TABLE Customer (
    customer_id SERIAL PRIMARY KEY,
    cust_name VARCHAR(100),
    cust_email VARCHAR(100),
    cust_address TEXT,
    cust_phoneNo VARCHAR(100) NOT NULL,
    cust_type VARCHAR(100) NOT NULL,
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	cust_password TEXT
);

CREATE TABLE Company(
    comp_id SERIAL PRIMARY KEY,
    comp_name VARCHAR(200) NOT NULL,
    comp_address TEXT NOT NULL,
    comp_phoneNo VARCHAR(100) NOT NULL
);

CREATE TABLE Department(
    dep_id SERIAL PRIMARY KEY,
    dep_name VARCHAR(100) NOT NULL,
    comp_id INT NOT NULL,
    FOREIGN KEY (comp_id) REFERENCES Company(comp_id)
);

CREATE TABLE client_approver(
    approver_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    signature_url TEXT,
    dep_id INT REFERENCES Department(dep_id),
    cust_email VARCHAR(150) NOT NULL
);

CREATE TABLE Reviews(
    review_id SERIAL PRIMARY KEY ,
    review_com TEXT,
	customer_id INT,
	FOREIGN KEY (customer_id) REFERENCES Customer(customer_id)
	
);

CREATE TABLE Branch(
    branch_ID SERIAL PRIMARY KEY,
    branch_location TEXT
);

CREATE TABLE Staff(
    staff_id SERIAL PRIMARY KEY ,
    staff_name VARCHAR(200) NOT NULL,
    staff_phone VARCHAR(12) NOT NULL,
    branch_ID INT NOT NULL,
    staff_role VARCHAR(100),
    staff_active_status BOOLEAN,
    FOREIGN KEY(branch_ID) REFERENCES Branch(branch_ID),
	staff_email VARCHAR(150) UNIQUE,
	staff_password TEXT
);



CREATE TABLE Invoice (
    invoice_id SERIAL PRIMARY KEY,
    invoice_type VARCHAR(100),
    customer_id INT,
    rider_id INT,
    issue_date DATE,
    billing_period_start DATE,
    billing_period_end DATE,
    total_amount DECIMAL(12,2),
    payment_status VARCHAR(100),
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    FOREIGN KEY (rider_id) REFERENCES Staff(staff_id)
);

CREATE TABLE Payment (
    payment_id SERIAL PRIMARY KEY ,
    invoice_id INT NOT NULL,
    payment_date TIMESTAMP,
    payment_method VARCHAR(100),
    amount DECIMAL(12,2),
    status VARCHAR(100),
    transaction_id VARCHAR(150),
    FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id)
);

CREATE TABLE ATR (
    atr_id SERIAL PRIMARY KEY,
    dep_id INT NOT NULL,
    atr_number VARCHAR(50) UNIQUE NOT NULL,
    required_date DATE,
    required_time TIME,
    vehicle_type VARCHAR(50),
    purpose_of_travel TEXT,
    principal_passenger_name VARCHAR(100),
    principal_passenger_designation VARCHAR(100),
    estimated_distance DECIMAL(8,2),
    estimated_cost DECIMAL(10,2),
    actual_distance DECIMAL(8,2),
    actual_cost DECIMAL(10,2),
    status VARCHAR(100),
    approved_by INT,
    approval_date TIMESTAMP,
    approval_token VARCHAR(255),
    client_approver_id INT,
    FOREIGN KEY (dep_id) REFERENCES Department(dep_id),
    FOREIGN KEY (approved_by) REFERENCES Staff(staff_id),
    FOREIGN KEY (client_approver_id) REFERENCES client_approver(approver_id)
);

CREATE TABLE Trip(
    trip_ID SERIAL PRIMARY KEY ,
    rider_ID INT NOT NULL,
    trip_date DATE,
    trip_status VARCHAR(100),
    FOREIGN KEY(rider_ID) REFERENCES Staff(staff_id)
);

CREATE TABLE Receiver(
    rec_NIC VARCHAR(100) PRIMARY KEY,
    rec_PHONE VARCHAR(12) NOT NULL,
    rec_NAME VARCHAR(70) NOT NULL,
    rec_LOCATION VARCHAR(100) NOT NULL
);

CREATE TABLE Courier_req(
    book_ID SERIAL PRIMARY KEY ,
    customer_ID INT NOT NULL,
    rec_NIC VARCHAR(100) NOT NULL,
    atr_ID INT NOT NULL,
    courier_date DATE,
    courier_weight TEXT,
    status VARCHAR(100),
    FOREIGN KEY(customer_ID) REFERENCES Customer(customer_id),
    FOREIGN KEY(rec_NIC) REFERENCES Receiver(rec_NIC),
    FOREIGN KEY(atr_ID) REFERENCES ATR(atr_id),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Delivery (
    del_ID SERIAL PRIMARY KEY ,
    delivery_status VARCHAR(100),
    pick_location TEXT,
    drop_location TEXT,
	book_ID INT NOT NULL REFERENCES Courier_req(book_ID),
    trip_ID INT NOT NULL REFERENCES Trip(trip_ID),
	created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Notification(
    notification_ID SERIAL PRIMARY KEY ,
    customer_ID INT NOT NULL,
    delivery_ID INT NOT NULL,
    notification_type VARCHAR(100),
    sent_date DATE,
    notification_msg TEXT,
    FOREIGN KEY(delivery_ID) REFERENCES Delivery(del_ID),
    FOREIGN KEY(customer_ID) REFERENCES Customer(customer_id)
);

CREATE TABLE Rider (
    NIC VARCHAR(20) PRIMARY KEY,
    Name VARCHAR(100) NOT NULL,
    Phone_Number VARCHAR(20) NOT NULL,
    Branch VARCHAR(100),
    Email VARCHAR(100) UNIQUE NOT NULL,
    Password VARCHAR(255) NOT NULL,
    NIC_Front_Image VARCHAR(255),
    NIC_Back_Image VARCHAR(255),
    Address TEXT,
    Emergency_Contact VARCHAR(20),
    Vehicle_Type VARCHAR(50),
    Vehicle_No VARCHAR(50),
    Driver_Licence_No VARCHAR(50)
);
