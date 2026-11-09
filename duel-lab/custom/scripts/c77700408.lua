--宵刻刃－極夜
--Dusk Hour Blade - Polar Night (original card)
--① ("gains the ② effects of its "Dusk Hour Blade" Xyz Materials") follows the EDOPro idiom: the materials
--("Lingering Night" / "White Night") register EFFECT_TYPE_XMATERIAL copies of their ② that work only for this card,
--sharing one once-per-turn count under this card's name ({id,0}): the gained effects are usable once per turn in total.
local s,id=GetID()
local SET_YOIKOKU_BLADE=0x17c3
function s.initial_effect(c)
	c:EnableReviveLimit()
	--Xyz Summon: 2 Level 8 "Dusk Hour Blade" Synchro Monsters
	Xyz.AddProcedure(c,s.matfilter,8,2)
	--② an Xyz Summoned card leaves the field: this turn, "Dusk Hour Blade" monsters you control gain the effect below
	local e2=Effect.CreateEffect(c)
	e2:SetDescription(aux.Stringid(id,1))
	e2:SetType(EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O)
	e2:SetProperty(EFFECT_FLAG_DELAY)
	e2:SetCode(EVENT_LEAVE_FIELD)
	e2:SetCountLimit(1,{id,1})
	e2:SetCondition(s.grcon)
	e2:SetOperation(s.grop)
	c:RegisterEffect(e2)
end
s.listed_series={SET_YOIKOKU_BLADE}
function s.matfilter(c)
	return c:IsSetCard(SET_YOIKOKU_BLADE) and c:IsType(TYPE_SYNCHRO)
end
function s.grcon(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	return c:IsPreviousLocation(LOCATION_MZONE) and c:IsSummonType(SUMMON_TYPE_XYZ)
end
function s.grop(e,tp,eg,ep,ev,re,r,rp)
	local c=e:GetHandler()
	--● (granted) either player's turn: return this card to hand/Extra Deck, target 1 card on the field, destroy it.
	--Once per turn per card name: after a monster is returned for it, monsters with that name cannot use it again this turn,
	--so return/re-summon loops (Kasumi ①, Sword Dance ②) stop.
	local e1=Effect.CreateEffect(c)
	e1:SetDescription(aux.Stringid(id,2))
	e1:SetCategory(CATEGORY_DESTROY)
	e1:SetType(EFFECT_TYPE_QUICK_O)
	e1:SetCode(EVENT_FREE_CHAIN)
	e1:SetProperty(EFFECT_FLAG_CARD_TARGET)
	e1:SetHintTiming(0,TIMINGS_CHECK_MONSTER_E+TIMING_END_PHASE)
	e1:SetRange(LOCATION_MZONE)
	e1:SetCondition(s.gcon)
	e1:SetCost(s.gcost)
	e1:SetTarget(s.gtg)
	e1:SetOperation(s.gop)
	local e2=Effect.CreateEffect(c)
	e2:SetType(EFFECT_TYPE_FIELD+EFFECT_TYPE_GRANT)
	e2:SetTargetRange(LOCATION_MZONE,0)
	e2:SetTarget(function(_,tc) return tc:IsSetCard(SET_YOIKOKU_BLADE) end)
	e2:SetLabelObject(e1)
	e2:SetReset(RESET_PHASE+PHASE_END)
	Duel.RegisterEffect(e2,tp)
end
--player flag per returned card name (77790000 + the last 4 digits of the code)
local function nameflag(c) return 77790000+c:GetCode()%10000 end
function s.gcon(e,tp,eg,ep,ev,re,r,rp)
	return Duel.GetFlagEffect(tp,nameflag(e:GetHandler()))==0
end
function s.gcost(e,tp,eg,ep,ev,re,r,rp,chk)
	local c=e:GetHandler()
	if chk==0 then return c:IsAbleToHandAsCost() or c:IsAbleToExtraAsCost() end
	Duel.RegisterFlagEffect(tp,nameflag(c),RESET_PHASE+PHASE_END,0,1)
	Duel.SendtoHand(c,nil,REASON_COST)
end
function s.gtg(e,tp,eg,ep,ev,re,r,rp,chk,chkc)
	if chkc then return chkc:IsOnField() and chkc~=e:GetHandler() end
	if chk==0 then return Duel.IsExistingTarget(nil,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,e:GetHandler()) end
	Duel.Hint(HINT_SELECTMSG,tp,HINTMSG_DESTROY)
	local g=Duel.SelectTarget(tp,nil,tp,LOCATION_ONFIELD,LOCATION_ONFIELD,1,1,e:GetHandler())
	Duel.SetOperationInfo(0,CATEGORY_DESTROY,g,1,0,0)
end
function s.gop(e,tp,eg,ep,ev,re,r,rp)
	local tc=Duel.GetFirstTarget()
	if tc and tc:IsRelateToEffect(e) then Duel.Destroy(tc,REASON_EFFECT) end
end
