import frappe
from frappe import _
import math
from datetime import datetime, timedelta

def get_distance(coord1, coord2):
    """
    Calculate the distance between two coordinates in kilometers using the Haversine formula.
    Coordinates should be in the format "latitude,longitude".
    """
    # Extract latitude and longitude from the coordinate strings
    lat1, lon1 = map(float, coord1.split(','))
    lat2, lon2 = map(float, coord2.split(','))

    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2d7ee245e00)

    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    # Earth's radius in meters
    earth_radius = 6371000

    # Calculate the distance in kilometers
    distance = earth_radius * c
    return distance

@frappe.whitelist()
def mark_attendance(image, entry_type):
    user = frappe.session.user
    employee = frappe.get_value("Employee", {"user_id": user}, ["name"], as_dict=True)
    store = frappe.db.get_value('Shift Assignment', {'employee': employee.get('name')}, 'store')
    payload = {
        "doctype": "Attendance",
        "employee": employee.get('name'),
        "store": store,
        "attendance_date": frappe.utils.today(),
        "image": image
    }
    if entry_type == 'Early':
        payload["early_exit"] = 1
    elif entry_type == 'Late':
        payload["late_entry"] = 1
    attendance_doc = frappe.get_doc(payload)
    checkin_filters = [
                ["Employee Checkin","employee","=",employee.get('name')],
                ["Employee Checkin","time","Between",[frappe.utils.today(),frappe.utils.today()]],
                ["Employee Checkin","log_type","=","IN"]
            ]
    checkout_filters = [
                ["Employee Checkin","employee","=",employee.get('name')],
                ["Employee Checkin","time","Between",[frappe.utils.today(),frappe.utils.today()]],
                ["Employee Checkin","log_type","=","OUT"]
            ]

    check_in_rec = frappe.db.get_list(
        "Employee Checkin",
       checkin_filters,
       ['name', 'time']
    )
    check_out_rec = frappe.db.get_list(
        "Employee Checkin",
       checkout_filters,
       ['name', 'time']
    )
    if check_in_rec:
        attendance_doc.in_time = check_in_rec[0].get("time")

    if check_out_rec:
        attendance_doc.out_time = check_out_rec[0].get("time")

    attendance_doc.insert(ignore_permissions=True)
    attendance_doc.submit()
    return attendance_doc.name


@frappe.whitelist()
def create_employee_checkin(datetime, log_type):
    user = frappe.session.user
    employee = frappe.get_value("Employee", {"user_id": user}, ["name", "store"], as_dict=True)
    shift = frappe.db.get_value('Shift Assignment', {'employee': employee.get('name')}, ['start_time', 'end_time'], as_dict=True)

    datetime_obj = frappe.utils.now_datetime()
    status = True
    # Validate the Check In Time
    # if not validated_checkin_time(datetime_obj, shift, log_type):
    #     status = False

    attendance_doc = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee.get('name'),
        "log_type": log_type,
        "time": datetime_obj
    })

    attendance_doc.insert(ignore_permissions=True)
    return status


def validated_checkin_time(datetime_obj, shift, log_type):
    if log_type == "IN":
        start_time = shift.get('start_time')
    else:
        start_time = shift.get('end_time')

    expected_checkin = datetime(datetime_obj.year, datetime_obj.month, datetime_obj.day,
                                int(start_time.total_seconds() / 3600),
                                int((start_time.seconds // 60)) % 60,
                                int(start_time.seconds % 60))

    time_difference = datetime_obj - expected_checkin

    if log_type == "IN":
        return time_difference <= timedelta(minutes=15)
    else:
        return time_difference >= timedelta(minutes=-15)


@frappe.whitelist()
def get_employee_details():
    user = frappe.session.user
    employee = frappe.get_value("Employee", {"user_id": user}, ["name", "employee_name", "store"], as_dict=True)
    shift = frappe.db.get_list('Shift Assignment', {'employee': employee.get('name'), "docstatus": ("!=", 2)}, ['store','start_time', 'end_time', "floater"])
    frappe.logger("floater").exception(shift)
    if not shift: return frappe.throw("Shift Not Assigned")
    if employee:
        return {
            "employee_id": employee.name,
            "employee_name": employee.employee_name,
            "shift": format_shift(shift),
            "check_in_time": validate_checkin(),
            "check_out_time": None,
            "is_floater": shift[0].get("floater")
        }
    else:
        return {
            "employee_id": "Admin",
            "employee_name": "Admin",
            "shift": "Morning",
            "check_in_time": None,
            "check_out_time": None,
            "is_floater": False
        }

def format_shift(shift):
    output = ""
    for s in shift:
        store = s['store']
        start_time = s['start_time']
        end_time = s['end_time']
        output += f"Store: {store} :- \nStart Time: {start_time}, End Time: {end_time}\n\n"

    return output


def convert_str_into_datetime(date_str):
    from datetime import datetime

    date_string = date_str
    date_format = "%m/%d/%Y, %I:%M:%S %p"

    datetime_obj = datetime.strptime(date_string, date_format)
    return datetime_obj

@frappe.whitelist()
def validate_attendance():
    user = frappe.session.user
    employee = frappe.get_value("Employee", {"user_id": user}, ["name"])
    return frappe.db.exists({
        "doctype": "Attendance",
        "employee": employee,
        "attendance_date": frappe.utils.today()
    })

@frappe.whitelist()
def validate_location(**kwargs):
    user = frappe.session.user
    current_location = kwargs.get('currentLocation')
    employee = frappe.get_doc("Employee", {"user_id": user}, ["name", "employee_name", "store"], as_dict=True)
    store = frappe.db.get_value('Shift Assignment', {'employee': employee.get('name')}, 'store')
    store_location = frappe.db.get_value('Store', {'name': store}, 'map_location')
    try:
        print("get_distance("+store_location+", "+current_location+") = "+str(get_distance(store_location, current_location)))
        if(get_distance(store_location, current_location) <= 100):
            return True
        else:
            return False
    except Exception as e:
        print(e)
        return False

@frappe.whitelist()
def validate_checkin():
    user = frappe.session.user
    employee = frappe.get_value("Employee", {"user_id": user}, ["name"])
    filters = [
                ["Employee Checkin","employee","=",employee],
                ["Employee Checkin","time","Between",[frappe.utils.today(),frappe.utils.today()]],
                ["Employee Checkin","log_type","=","IN"]
    ]

    check_in_rec = frappe.db.get_list(
        "Employee Checkin",
       filters,
       ['name', 'time']
    )
    if check_in_rec:
        from datetime import datetime

        input_datetime = str(check_in_rec[0].get('time'))
        datetime_obj = datetime.strptime(input_datetime, "%Y-%m-%d %H:%M:%S.%f")

        formatted_datetime = datetime_obj.strftime("%m/%d/%Y, %I:%M:%S %p")
        return formatted_datetime # Output: 06/22/2023, 01:58:23 PM

    else:
        return None

@frappe.whitelist()
def validate_face(**kwargs):
    user = frappe.session.user
    name = kwargs.get('name')
    photo = frappe.get_doc('Photo',{'photo':name})
    people_array = photo.people
    if not photo.is_processed:
        return 'NOT_PROCESSED'
    if people_array:
        faces = []
        for person in people_array:
            face = frappe.get_doc('ROI',person.face)
            faces.append(face)
            if face.person == None:
                return {"error":"This Face is Not Recognised"}
            person = frappe.get_doc('Person',face.person)
            if person.user == user:
                return True
            else:
                continue
        return {'error': 'Face Not Matched, Kindly Re-upload Your Photo'}
    else:
        return {'error': 'No Faces Detected, Kindly Re-upload Your Photo'}
#     add face recognition logic here
