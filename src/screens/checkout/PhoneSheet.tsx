import { useEffect, useState } from 'react';
import { useNav } from '../../nav/stack';
import { useApp } from '../../store/app';
import { Sheet } from '../../ui/parts';
import { useCheckout } from './useCheckout';
import './checkout.css';

export function PhoneSheet({ payNow, comment }: { payNow: boolean; comment: string }) {
  const nav = useNav();
  const setPhone = useApp((s) => s.setPhone);
  const { finish } = useCheckout();
  const [number, setNumber] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [agree, setAgree] = useState(true);
  const digits = number.replace(/\D/g, '');

  useEffect(() => {
    if (code.length !== 4) return;
    setPhone(digits);
    if (payNow) nav.replaceTop({ type: 'kaspi', comment });
    else void finish(false);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet onClose={nav.pop} label="Вход по номеру">
      <div className="pad sheet-body">
        {step === 'phone' ? (
          <>
            <div className="h1 sheet-title">Последний шаг: номер</div>
            <p className="muted phone-text">Заведение видит заказ по номеру, чек и бонусы придут сюда же. Корзина сохранится.</p>
            <label className="row phone-field">
              <b>+7</b>
              <input
                id="phone"
                inputMode="numeric"
                autoComplete="off"
                placeholder="700 000 00 00"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
            </label>
            <label className="row small muted phone-agree">
              <input id="agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              Согласен с условиями и обработкой персональных данных
            </label>
            <button className="btn phone-next" disabled={digits.length !== 10 || !agree} onClick={() => setStep('code')}>
              Получить код
            </button>
            <p className="small muted center">Демо: SMS не отправляется, номер никуда не уходит.</p>
          </>
        ) : (
          <>
            <div className="h1 sheet-title">Код из SMS</div>
            <p className="muted">
              Отправили бы на +7 {digits.slice(0, 3)} ••• {digits.slice(6, 8)} {digits.slice(8)} ·{' '}
              <button className="text-link" onClick={() => setStep('phone')}>
                изменить
              </button>
            </p>
            <input
              id="code"
              className="code-field"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <p className="small muted center">Демо: подойдут любые 4 цифры.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
