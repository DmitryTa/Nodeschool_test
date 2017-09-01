(function() {
    
    class Validator {
        constructor(config) {
            this.config = config;
            this.messages = [];
            this.types = {
                fioValidate: {
                    validate: function(val) {
                        const data = val.trim().split(' ').filter((str) => str !== '');
                        return data.length === 3 && 
                            data.every((str) => /^[a-zа-яё]+$/i.test(str) === true); 
                    },
                    errorMessage: 'ФИО должно состоять из трех слов'
                },
                emailValidate: {
                    validate: function(val) {
                        const allowedDomains = ['ya.ru', 'yandex.ru', 'yandex.ua', 'yandex.by', 'yandex.kz', 'yandex.com'];
                        const parts = val.trim().split('@');

                        if (parts.length !== 2) {
                            return false;
                        }
                        if (allowedDomains.indexOf(parts[1]) === -1) {
                            return false;
                        }
                        return /^(\w+?.?)+\w+$/.test(parts[0]);
                    },
                    errorMessage: 'Неверный email'
                },
                phoneValidate: {
                    validate: function(val) {
                        return /\+7\(\d{3}\)\d{3}-\d{2}-\d{2}/.test(val.trim());
                    },
                    errorMessage: 'Неверный формат'
                },
                phoneNumberSum: {
                    validate: function(val) {
                        const numberSum = val.split('').reduce((sum, cur) => {
                            if (!isNaN(parseInt(cur))) {
                                sum += +cur;
                            }
                            return sum;
                        }, 0);

                        return numberSum > 30? false : true;
                    },
                    errorMessage: 'Cумма всех цифр телефона не должна превышать 30'
                }
            }
        }

        validate(data) {
            let types, type, checker, errors, isValid;
            this.messages = [];

            for (let i in data) {
                if (data.hasOwnProperty(i)) {
                    types = this.config[i];
                    if (!types) {
                        continue;
                    }
                    errors = [];
                    types = typeof types === 'string' ? [types] : types;
                    for (type of types) {
                        checker = this.types[type];
                        
                        if (!checker) {
                            throw new Error(`Нет обработчика ${type}`);
                        }

                        isValid = checker.validate(data[i]);
                        if (!isValid) {
                            errors.push(checker.errorMessage);
                        }
                    }
                }
                if (!!errors.length) {
                    this.messages.push({
                        field: i,
                        messages: errors
                    }); 
                }   
            }
            return !this.hasErrors();
        }

        hasErrors() {
            return !!this.messages.length 
        }

        getErrors() {
            return this.messages.map((message) => Object.assign({}, message));
        }
    }

    class FormController {
        constructor(formElem, validationRules) {
            this.form = formElem;
            this.rules = validationRules;
            this.validator = new Validator(this.rules);
            this.validationResult = null;
            this.formInputs = [...this.form.elements].filter(elem => {
                return elem.nodeName === 'INPUT' && this.rules.hasOwnProperty(elem.name);
            });
        }

        validate() {
            const validator = this.validator;
            validator.validate(this.getData());
            this.validationResult =  {
                isValid: !validator.hasErrors(),
                errorFields: validator.getErrors().map(error => error.field)
            }
            return this.validationResult;
        }

        getData() {
            return this.formInputs.reduce((data, elem) => {
                data[elem.name] = elem.value;
                return data;
            }, {});
        }

        // Поскольку в описании метода setData отсутствует информация о поведении инпутов,
        // не указанных в newData, при вызове этого метода,
        // их значения останутся без изменений  
        setData(newData) {
            for (let key in newData) {
                if (this.rules.hasOwnProperty(key)) {
                    this.form.elements[key].value = newData[key];
                };
            }
        }

        showErrors() {
            if (!this.validationResult || this.validationResult.isValid) {
                return;
            } 
            this.formInputs.forEach(input => {
                if (this.validationResult.errorFields.indexOf(input.name) > -1) {
                    input.classList.add('error');
                }
            });
        }

        removeErrors() {
            this.formInputs.forEach(elem => {
                elem.classList.contains('error') && elem.classList.remove('error');
            });
        }

        submit(event) {
            const submitBtn = document.getElementById('submitButton');
            this.removeErrors();
            const validationResult = this.validate();
            if (validationResult.isValid) {
                submitBtn.disabled = true;
                
                const queryString = this.formInputs.reduce((str, input) => {
                    return str += `${encodeURIComponent(input.name)}=${encodeURIComponent(input.value)}&` 
                }, '').slice(0, -1);
        
                const request = () => {
                    fetch(`${this.form.action}?${queryString}`)
                        .then(response => {
                            return response.json();
                        }).then(data => {
                            switch(data.status) {
                                case 'success': 
                                    container.showResult('success', 'Success');
                                    submitBtn.disabled = false; 
                                break;
                                case 'error': 
                                    container.showResult('error', data.reason);
                                    submitBtn.disabled = false; 
                                break;
                                case 'progress':
                                    container.showResult('progress');
                                    setTimeout(request, data.timeout);
                                break;
                            }      
                        }).catch(console.error);
                }
                request();
            } else {
                this.showErrors();
                container.clear();
            }
            event && event.preventDefault();
        }
    }

    class ContainerController {
        constructor(elem) {
            this.elem = elem;
            this.status = null;
        }

        clear() {
            if (this.status) {
                this.elem.classList.remove(this.status);
                this.elem.textContent = '';
                this.status = null;
            }
        }

        showResult(status, msg) {
            this.clear();
            this.status = status;
            this.elem.classList.add(status);
            if (msg) {
                this.elem.textContent = msg;
            }
        }
    }

    const container = new ContainerController(document.getElementById('resultContainer'));
    
    const config = {
        fio: 'fioValidate',
        phone: ['phoneValidate', 'phoneNumberSum'],
        email: 'emailValidate'
    }

    const form = new FormController(document.getElementById('myForm'), config);

    document.getElementById('submitButton').addEventListener('click', form.submit.bind(form));

    const exportMethods = (methods) => {
        window.MyForm = Object.create(null);
        methods.forEach(method => window.MyForm[method] = form[method].bind(form));
    }

    exportMethods(['validate', 'setData', 'getData', 'submit']);

})();
    
