CREATE TABLE Customer (
    customer_id INT NOT NULL ,
    cust_name VARCHAR(100),
    cust_email VARCHAR(100),
    cust_address TEXT,
    cust_phoneNo VARCHAR(100) NOT NULL,
    cust_type VARCHAR(100) NOT NULL,
    PRIMARY KEY (customer_id)
);

CREATE TABLE Company(
    comp_id INT NOT NULL ,
    comp_name VARCHAR(200) NOT NULL,
    comp_address TEXT NOT NULL,
    comp_phoneNo VARCHAR(100) NOT NULL,
    PRIMARY KEY (comp_id)
);

CREATE TABLE Department(
    dep_id INT NOT NULL ,
    dep_name VARCHAR(100) NOT NULL,
    comp_id INT NOT NULL,
    PRIMARY KEY(dep_id),
    FOREIGN KEY (comp_id) REFERENCES Company(comp_id)
);

CREATE TABLE Reviews(
    review_id INT NOT NULL ,
    review_com TEXT,
    PRIMARY KEY(review_id)
);

CREATE TABLE BRANCH(
    branch_ID INT NOT NULL ,
    branch_location TEXT,
    PRIMARY KEY(branch_ID)
);

CREATE TABLE STAFF(
    staff_id INT NOT NULL ,
    staff_name VARCHAR(200) NOT NULL,
    staff_phone VARCHAR(12) NOT NULL,
    branch_ID INT NOT NULL,
    staff_role VARCHAR(100),
    staff_active_status VARCHAR(100),
    PRIMARY KEY (staff_id),
    FOREIGN KEY(branch_ID) REFERENCES BRANCH(branch_ID)
);



CREATE TABLE Invoice (
    invoice_id INT NOT NULL ,
    invoice_type VARCHAR(100),
    customer_id INT,
    rider_id INT,
    issue_date DATE,
    billing_period_start DATE,
    billing_period_end DATE,
    total_amount DECIMAL(12,2),
    payment_status VARCHAR(100),
    PRIMARY KEY(invoice_id),
    FOREIGN KEY (customer_id) REFERENCES Customer(customer_id),
    FOREIGN KEY (rider_id) REFERENCES STAFF(staff_id)
);

CREATE TABLE Payment (
    payment_id INT NOT NULL ,
    invoice_id INT NOT NULL,
    payment_date TIMESTAMP,
    payment_method VARCHAR(100),
    amount DECIMAL(12,2),
    status VARCHAR(100),
    transaction_id VARCHAR(150),
    PRIMARY KEY(payment_id),
    FOREIGN KEY (invoice_id) REFERENCES Invoice(invoice_id)
);

CREATE TABLE ATR (
    atr_id INT NOT NULL ,
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
    PRIMARY KEY(atr_id),
    FOREIGN KEY (dep_id) REFERENCES Department(dep_id),
    FOREIGN KEY (approved_by) REFERENCES STAFF(staff_id)
);

CREATE TABLE TRIP(
    trip_ID INT NOT NULL ,
    rider_ID INT NOT NULL,
    trip_date DATE,
    trip_status VARCHAR(100),
    PRIMARY KEY(trip_ID),
    FOREIGN KEY(rider_ID) REFERENCES STAFF(staff_id)
);

CREATE TABLE DELIVERY (
    del_ID INT NOT NULL ,
    book_ID INT NOT NULL,
    trip_ID INT NOT NULL,
    delivery_status VARCHAR(100),
    pick_location TEXT,
    drop_location TEXT,
    PRIMARY KEY (del_ID),
    FOREIGN KEY (trip_ID) REFERENCES TRIP(trip_ID)
);

CREATE TABLE NOTIFICATION(
    notification_ID INT NOT NULL ,
    customer_ID INT NOT NULL,
    delivery_ID INT NOT NULL,
    notification_type VARCHAR(100),
    sent_date DATE,
    notification_msg TEXT,
    PRIMARY KEY(notification_ID),
    FOREIGN KEY(delivery_ID) REFERENCES DELIVERY(del_ID),
    FOREIGN KEY(customer_ID) REFERENCES Customer(customer_id)
);

CREATE TABLE RECEIVER(
    rec_NIC VARCHAR(100) NOT NULL,
    rec_PHONE VARCHAR(12) NOT NULL,
    rec_NAME VARCHAR(70) NOT NULL,
    rec_LOCATION VARCHAR(100) NOT NULL,
    PRIMARY KEY(rec_NIC)
);

CREATE TABLE COURIER_REQ(
    book_ID INT NOT NULL ,
    customer_ID INT NOT NULL,
    delivery_ID INT NOT NULL,
    rec_NIC VARCHAR(100) NOT NULL,
    atr_ID INT NOT NULL,
    courier_date DATE,
    courier_weight TEXT,
    status VARCHAR(100),
    PRIMARY KEY(book_ID),
    FOREIGN KEY(customer_ID) REFERENCES Customer(customer_id),
    FOREIGN KEY(delivery_ID) REFERENCES DELIVERY(del_ID),
    FOREIGN KEY(rec_NIC) REFERENCES RECEIVER(rec_NIC),
    FOREIGN KEY(atr_ID) REFERENCES ATR(atr_id)
);